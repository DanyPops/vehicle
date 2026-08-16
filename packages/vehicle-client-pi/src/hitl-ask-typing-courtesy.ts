/**
 * Typing-courtesy debounce for requestPiAskPrompt: waits out real, recent keystroke activity
 * elsewhere in the editor before popping a live ask open, so a person mid-sentence is never
 * abruptly interrupted. Split out of hitl-ask-prompt.ts as its own self-contained subsystem --
 * zero coupling to AskComponent's own rendering, only to the ambient keystroke clock it owns.
 */

import type { AgentToolUpdateCallback } from "@earendil-works/pi-coding-agent";
import type { PiHitlContext } from "./hitl-prompt.js";

/**
 * Tracks whether a live ask is genuinely mid-flight, blocked on the human. `ExtensionContext.isIdle()`
 * means "not streaming a model response" -- it reads true while a slow, human-blocking tool call
 * like this one is still pending, since the model already finished emitting the tool_call and
 * is not itself generating anything. Left unguarded, that lets the active-task continuation
 * driver (extension/src/index.ts's driveActiveTasks, on agent_settled) queue a "continue the
 * active task" nudge as a `deliverAs: "nextTurn"` message while this exact live ask is still
 * awaiting an answer -- starting a second, concurrent turn that reasons about the very Discussion
 * this call is already resolving, independently of it. driveActiveTasks checks isLiveAskPending()
 * and skips queuing while true.
 *
 * globalThis + Symbol.for() (see activity-broker.ts/vehicle-shell-registry.ts for the same
 * convention), not a plain module-level counter: this coordinates ACROSS extensions on purpose --
 * one extension's ask-prompt marking pending must be visible to a DIFFERENT extension's
 * continuation driver checking isLiveAskPending(). Several nested copies of vehicle-client-pi can
 * be loaded in one process (each extension's own semver-pinned dependency range, hoisted or
 * nested independently) -- a plain `let` would give each duplicate copy its own independent
 * counter, silently defeating the cross-extension coordination this exists for: extension A marks
 * its own copy pending, extension B's continuation driver reads its own, still-zero copy, and
 * queues the nudge anyway while the human is still mid-answer. Versioned key ("@1") so a future
 * breaking shape change -- there is none today, a bare count -- gets a fresh slot instead of
 * corrupting this one.
 */
const LIVE_PENDING_COUNT_KEY = Symbol.for("vehicle.pi.hitl-ask-pending@1");

function livePendingCountHolder(): { count: number } {
	const holder = globalThis as { [LIVE_PENDING_COUNT_KEY]?: { count: number } };
	if (!holder[LIVE_PENDING_COUNT_KEY]) holder[LIVE_PENDING_COUNT_KEY] = { count: 0 };
	return holder[LIVE_PENDING_COUNT_KEY];
}

export function isLiveAskPending(): boolean {
	return livePendingCountHolder().count > 0;
}

export function markAskPromptPending(): void {
	livePendingCountHolder().count += 1;
}

export function markAskPromptSettled(): void {
	livePendingCountHolder().count -= 1;
}

const DISCUSS_TYPING_COURTESY_DEFAULT_POLL_MS = 100;
const DISCUSS_TYPING_COURTESY_DEFAULT_INITIAL_QUIET_MS = 1_500;
const DISCUSS_TYPING_COURTESY_DEFAULT_QUIET_FLOOR_MS = 300;
const DISCUSS_TYPING_COURTESY_DEFAULT_DECAY_HORIZON_MS = 10_000;

let typingCourtesyPollMs = DISCUSS_TYPING_COURTESY_DEFAULT_POLL_MS;
let typingCourtesyInitialQuietMs = DISCUSS_TYPING_COURTESY_DEFAULT_INITIAL_QUIET_MS;
let typingCourtesyQuietFloorMs = DISCUSS_TYPING_COURTESY_DEFAULT_QUIET_FLOOR_MS;
let typingCourtesyDecayHorizonMs = DISCUSS_TYPING_COURTESY_DEFAULT_DECAY_HORIZON_MS;

/** Test-only: the real decay curve runs over seconds, too slow to exercise at its real scale in a unit test. */
export function setTypingCourtesyTimingForTests(overrides?: {
	pollMs?: number;
	initialQuietMs?: number;
	floorMs?: number;
	decayHorizonMs?: number;
}): void {
	typingCourtesyPollMs = overrides?.pollMs ?? DISCUSS_TYPING_COURTESY_DEFAULT_POLL_MS;
	typingCourtesyInitialQuietMs = overrides?.initialQuietMs ?? DISCUSS_TYPING_COURTESY_DEFAULT_INITIAL_QUIET_MS;
	typingCourtesyQuietFloorMs = overrides?.floorMs ?? DISCUSS_TYPING_COURTESY_DEFAULT_QUIET_FLOOR_MS;
	typingCourtesyDecayHorizonMs = overrides?.decayHorizonMs ?? DISCUSS_TYPING_COURTESY_DEFAULT_DECAY_HORIZON_MS;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve) => {
		if (signal?.aborted) {
			resolve();
			return;
		}
		const timer = setTimeout(resolve, ms);
		signal?.addEventListener(
			"abort",
			() => {
				clearTimeout(timer);
				resolve();
			},
			{ once: true },
		);
	});
}

/**
 * Required quiet gap (no keystroke) before a live ask may open, as a function of how long we've
 * already been waiting. Starts wide (a natural inter-word pause shouldn't count as "done typing")
 * and decays toward a floor -- someone typing continuously gets pickier treatment over time
 * rather than never being asked. No outer cap: someone typing with sub-floor gaps forever waits
 * forever, same as the picker itself already waits indefinitely for a real human answer once open.
 */
function requiredQuietMsAt(elapsedMs: number): number {
	const t = Math.min(1, Math.max(0, elapsedMs / typingCourtesyDecayHorizonMs));
	return typingCourtesyInitialQuietMs - t * (typingCourtesyInitialQuietMs - typingCourtesyQuietFloorMs);
}

/**
 * Ambient, session-lifetime keystroke clock -- deliberately NOT scoped per-ask. A per-ask listener
 * would only see keystrokes from the moment the tool call happens to start, missing typing already
 * in progress when it began (the exact case this feature exists to protect). Attached once per
 * distinct ui instance (reference equality; a session's real ui object is stable for its lifetime)
 * and left attached -- there is no unregister, matching onTerminalInput's own listener-return-value
 * contract elsewhere in this file.
 */
let lastKeystrokeAt = 0;
let trackedUi: PiHitlContext["ui"] | undefined;

export function ensureTypingCourtesyTracking(ui: PiHitlContext["ui"]): void {
	if (typeof ui.onTerminalInput !== "function" || trackedUi === ui) return;
	trackedUi = ui;
	ui.onTerminalInput(() => {
		lastKeystrokeAt = Date.now();
		return undefined;
	});
}

/** Test-only: clears the ambient keystroke clock so one test's simulated typing can't bleed into another's. */
export function resetTypingCourtesyTrackingForTests(): void {
	lastKeystrokeAt = 0;
	trackedUi = undefined;
}

/**
 * Whether there is real, recent typing activity to wait out right now -- a plain synchronous read
 * of the ambient keystroke clock so the common case (nobody typing) never forces the caller
 * through an extra microtask. Deliberately not folded into waitForTypingCourtesy itself: an
 * unconditional `await` there -- even one that resolves immediately -- still yields once, which is
 * enough to let a signal aborted synchronously right after invoking askQuestion race past the
 * abort listener registered deeper in askQuestionBlocking and get missed entirely.
 */
export function isRecentlyTyping(): boolean {
	return lastKeystrokeAt > 0 && Date.now() - lastKeystrokeAt < typingCourtesyInitialQuietMs;
}

/**
 * Waits out real keystroke activity (not editor text content -- that can't distinguish "actively
 * typing" from "a stale draft sitting there", and misses a mid-thought erase-and-resume) before
 * popping the live ask over it. Only call when isRecentlyTyping() is already true.
 */
export async function waitForTypingCourtesy(params: { onUpdate?: AgentToolUpdateCallback; signal?: AbortSignal }): Promise<void> {
	const startedAt = Date.now();
	let announced = false;
	while (lastKeystrokeAt > 0 && !params.signal?.aborted) {
		const elapsed = Date.now() - startedAt;
		if (Date.now() - lastKeystrokeAt >= requiredQuietMsAt(elapsed)) return;
		if (!announced) {
			announced = true;
			params.onUpdate?.({ content: [{ type: "text", text: "Waiting for you to finish typing before asking..." }], details: undefined });
		}
		await sleep(typingCourtesyPollMs, params.signal);
	}
}
