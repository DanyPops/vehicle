/**
 * The "Toolbox Reminder" half of the Vehicle Shell's apropos/whatis-inspired design: weighted-lru.ts
 * + context-budget.ts already implement the EVICTION direction (a heavy, rarely-used tool cycles
 * OUT of the active set under budget pressure) -- nothing proactively re-surfaces a relevant-but-
 * currently-inactive tool back INTO context. This is that other direction: a bounded, one-shot,
 * context-injected nudge (never a forced reactivation) for a consumer-declared core operation that
 * fell out of the active set and has stayed inactive long enough to be worth mentioning again.
 *
 * Pure, Pi-agnostic state machine with no dependency on the rest of the shell -- same testability
 * discipline as weighted-lru.ts/ttl-tracker.ts. Deliberately does NOT duplicate either of those:
 * it only ever tracks a tool AFTER weighted-lru.ts's own evictToBudget has already removed it (see
 * bootstrap.ts's own wiring), and it reports nothing itself -- delivery reuses agent-poll-ticker.ts's
 * existing AgentNotifier/frameAsBackgroundNotification, the same non-turn-forcing background-message
 * mechanism pi-pipes/pi-papyrus already ship, rather than inventing a second one.
 */

export interface ToolboxReminderCandidate {
	readonly toolName: string;
	/** Human-readable identity for the reminder message and for reactivation instructions -- the
	 * namespaced "<vehicle>:<operation>" name tools_man itself documents, not the raw Pi toolName. */
	readonly label: string;
}

export interface ToolboxReminderOptions {
	/** A candidate must have been inactive at least this many tick() calls (turn boundaries) --
	 * OR at least minMsSinceInactive real milliseconds, whichever threshold it crosses first --
	 * before it's ever reported due. Defaults to DEFAULT_MIN_TURNS_SINCE_INACTIVE. */
	readonly minTurnsSinceInactive?: number;
	/** See minTurnsSinceInactive -- the wall-clock counterpart. Defaults to
	 * DEFAULT_MIN_MS_SINCE_INACTIVE. Set either bound to Number.POSITIVE_INFINITY to effectively
	 * disable that one dimension and gate on the other alone. */
	readonly minMsSinceInactive?: number;
	/** Bounded capacity, matching this codebase's own extensibility-point discipline (see
	 * MAX_PENDING_APPROVALS/MAX_LISTENERS_PER_EVENT/MAX_EXECUTION_MIDDLEWARES in AGENTS.md) --
	 * defaults to DEFAULT_MAX_TRACKED_TOOLBOX_REMINDER_CANDIDATES. */
	readonly maxTrackedCandidates?: number;
	/** Injectable clock for deterministic tests. Defaults to Date.now. */
	now?(): number;
}

/** Turn-based default: comparable in order of magnitude to the pre-weighted-LRU
 * DEFAULT_CORE_TTL_TURNS+DEFAULT_DISCOVERED_TTL_TURNS baseline (state.ts) -- long enough that a
 * core operation cycling out under one momentary budget squeeze doesn't immediately nag about it. */
export const DEFAULT_MIN_TURNS_SINCE_INACTIVE = 20;
/** Wall-clock default: deliberately longer than agent-poll-ticker's own 5-minute job-ticker
 * default -- this is a much lower-urgency, purely informational nudge, not a running job update. */
export const DEFAULT_MIN_MS_SINCE_INACTIVE = 15 * 60_000;
export const DEFAULT_MAX_TRACKED_TOOLBOX_REMINDER_CANDIDATES = 25;

interface TrackedCandidate {
	readonly label: string;
	readonly inactiveSinceTurn: number;
	readonly inactiveSinceMs: number;
}

/**
 * Tracks core-operation tools that have gone inactive (evicted, or otherwise no longer part of the
 * active set) and decides, once per turn boundary, which ones have been inactive long enough to be
 * worth a one-shot reminder. Never itself decides WHETHER a tool is "relevant" -- that judgment is
 * entirely the caller's (bootstrap.ts only ever calls recordInactive for a consumer-declared core
 * operation, per the Toolbox Reminder's own design: "plausibly relevant" == a vehicle already
 * marked it important enough to seed eagerly at registration).
 */
export class ToolboxReminderTracker {
	private readonly candidates = new Map<string, TrackedCandidate>();
	private turn = 0;
	private readonly minTurns: number;
	private readonly minMs: number;
	private readonly maxTracked: number;
	private readonly now: () => number;

	constructor(options: ToolboxReminderOptions = {}) {
		this.minTurns = options.minTurnsSinceInactive ?? DEFAULT_MIN_TURNS_SINCE_INACTIVE;
		this.minMs = options.minMsSinceInactive ?? DEFAULT_MIN_MS_SINCE_INACTIVE;
		this.maxTracked = options.maxTrackedCandidates ?? DEFAULT_MAX_TRACKED_TOOLBOX_REMINDER_CANDIDATES;
		this.now = options.now ?? Date.now;
	}

	/**
	 * Starts tracking `toolName` as a candidate the moment it goes inactive -- a no-op if already
	 * tracked, so a flapping evict/reseed/evict cycle (recordActive was never called in between)
	 * never resets its own inactive-since clock and lets it dodge the threshold indefinitely.
	 * Bounded: at capacity, the single oldest-tracked candidate is dropped to make room -- never
	 * throws, matching every other tracker in this directory (WeightedLruTracker,
	 * VehicleShellTtlTracker never throw either; this is best-effort bookkeeping, not a
	 * caller-facing request that can reasonably be refused).
	 */
	recordInactive(toolName: string, label: string): void {
		if (this.candidates.has(toolName)) return;
		if (this.candidates.size >= this.maxTracked) {
			const oldest = this.candidates.keys().next().value;
			if (oldest !== undefined) this.candidates.delete(oldest);
		}
		this.candidates.set(toolName, { label, inactiveSinceTurn: this.turn, inactiveSinceMs: this.now() });
	}

	/** Clears tracking the moment a candidate becomes active again -- its inactive episode is over;
	 * a later eviction starts a brand new one via recordInactive, with its own fresh clock. A no-op
	 * for a name this tracker isn't tracking. */
	recordActive(toolName: string): void {
		this.candidates.delete(toolName);
	}

	/**
	 * One call per turn boundary, mirroring WeightedLruTracker.evictToBudget's own "once per turn"
	 * contract: advances the turn counter, then returns every candidate that has crossed EITHER
	 * configured threshold (turns OR wall-clock, whichever comes first) -- and permanently stops
	 * tracking each one returned. A one-shot reminder per inactive episode, never repeated nagging:
	 * if the same tool goes inactive again later, recordInactive starts a fresh episode with its
	 * own fresh clock.
	 */
	tick(): { readonly due: readonly ToolboxReminderCandidate[] } {
		this.turn += 1;
		const nowMs = this.now();
		const due: ToolboxReminderCandidate[] = [];
		for (const [toolName, candidate] of this.candidates) {
			const turnsElapsed = this.turn - candidate.inactiveSinceTurn;
			const msElapsed = nowMs - candidate.inactiveSinceMs;
			if (turnsElapsed >= this.minTurns || msElapsed >= this.minMs) due.push({ toolName, label: candidate.label });
		}
		for (const candidate of due) this.candidates.delete(candidate.toolName);
		return { due };
	}

	/** Currently-tracked candidate count -- test/diagnostic use. */
	size(): number {
		return this.candidates.size;
	}
}

/**
 * Combines every due candidate into ONE message (never one message per candidate, matching
 * agent-poll-ticker.ts's own "every vanished key reported together" convention) -- framing is the
 * caller's job (bootstrap.ts wraps this via agent-poll-ticker.ts's frameAsBackgroundNotification,
 * the same non-turn-forcing background-message contract every other Vehicle-backed nudge uses).
 */
export function buildToolboxReminderMessage(due: readonly ToolboxReminderCandidate[], manToolName: string): string {
	const names = due.map((candidate) => candidate.label).join(", ");
	const plural = due.length > 1 ? "these were" : "this was";
	return (
		`Toolbox reminder: ${names} -- previously active but ${plural} evicted from the tool budget a while ago and ` +
		`hasn't been used since. Still relevant? Call ${manToolName} with its name to reactivate it -- otherwise no ` +
		`action needed.`
	);
}
