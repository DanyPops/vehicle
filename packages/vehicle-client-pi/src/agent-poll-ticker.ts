/**
 * The pure decision step behind "a background poll should sometimes interrupt the agent itself,
 * not just repaint a widget" -- extracted after two independent Vehicle-backed Pi extensions each
 * hand-rolled their own version of this: @danypops/pi-pipes' own job-ticker.ts (a ci_subscribe'd
 * job finishing, or still running after a while) and pi-papyrus's ActiveTaskContinuation (a task's
 * own continue/pause driving). The same "confirmed independently more than once, extract it" bar
 * this package's other modules were built past (see pi-status-refresh.ts's and
 * vehicle-watched-refresh.ts's own doc comments).
 *
 * Two distinct triggers, in priority order:
 *  1. A previously-tracked row disappearing between two ticks -- reported immediately, regardless
 *     of how little time has passed. Every confirmed use case so far treats "it's gone" as a
 *     one-shot completion signal (e.g. a daemon's own watched-set dropping a run the moment it
 *     goes terminal, because the daemon itself can't give an accurate final status through that
 *     same watched-only view -- probing directly, once notified, is cheap and exactly what the
 *     agent would do next anyway). Every key that vanished in the same tick is reported together
 *     in one message, not one call per row.
 *  2. A slow, throttled "still going" reminder for whatever remains, so a long-running background
 *     item periodically prompts the agent to check in rather than only ever being mentioned once.
 *     Never fires on the ticker's own first tick -- there is no reminder to give about something
 *     the caller only just started tracking, which the agent (having just subscribed to it) all
 *     but certainly already knows about. Omit buildReminderMessage entirely for a vanish-only
 *     ticker (e.g. "notify once this finishes", never "check in periodically").
 *
 * No I/O, no ExtensionAPI, no timers -- call tick() from whatever poll loop already exists (a
 * BoundedPoll, a session_start handler, a push-channel callback) with each successful fetch's
 * fresh rows. A failed fetch must never be fed here: an empty result from a transient outage would
 * otherwise read as every tracked row having vanished at once -- skip the tick entirely instead
 * (see AgentPollTicker's own class doc).
 *
 * createAgentNotifier()/reportAgentPollTick() are the other half: the actual pi.sendUserMessage
 * delivery, plus the one footgun worth centralizing once instead of every caller re-discovering it
 * -- pi.sendUserMessage() throws if called with no `deliverAs` while the agent is mid-turn
 * (confirmed against Pi's own agent-session.js `prompt()` dispatch: the "not streaming" branch
 * ignores `deliverAs` entirely and always sends+triggers immediately, so passing "steer"
 * unconditionally is correct and safe in both states, not just a streaming-only default).
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const DEFAULT_REMINDER_INTERVAL_MS = 5 * 60_000;

export interface AgentPollTickerOptions<Row> {
	/** Extracts a stable identity key from a row -- used to detect a row disappearing between ticks. */
	key(row: Row): string;
	/** Builds the message sent when one or more previously-tracked rows disappear between ticks. */
	buildVanishedMessage(vanishedKeys: string[]): string;
	/** Builds the periodic "still going" reminder for whatever rows remain. Omit to only ever
	 * report vanish transitions, never a periodic reminder. */
	buildReminderMessage?(rows: readonly Row[]): string;
	/** Minimum real-world gap between two reminders. Defaults to 5 minutes. */
	reminderIntervalMs?: number;
	/** Injectable clock for deterministic tests. Defaults to Date.now. */
	now?(): number;
}

export class AgentPollTicker<Row> {
	private previousKeys = new Set<string>();
	private lastReminderAt: number;
	private readonly reminderIntervalMs: number;
	private readonly now: () => number;

	constructor(private readonly options: AgentPollTickerOptions<Row>) {
		this.reminderIntervalMs = options.reminderIntervalMs ?? DEFAULT_REMINDER_INTERVAL_MS;
		this.now = options.now ?? Date.now;
		// Starts the reminder clock at construction, not epoch zero -- a row just started being
		// tracked (which the agent already knows about, having just asked for it) must not
		// immediately trigger a redundant reminder on this ticker's very first tick.
		this.lastReminderAt = this.now();
	}

	/**
	 * Call at most once per real, successful poll, in order. Mutates this ticker's own
	 * transition/throttle state as a side effect of being told about this tick -- never feed it a
	 * failed fetch's result (see this module's own doc comment).
	 */
	tick(rows: readonly Row[]): string | undefined {
		const currentKeys = new Set(rows.map((row) => this.options.key(row)));
		const vanished = [...this.previousKeys].filter((key) => !currentKeys.has(key));
		this.previousKeys = currentKeys;

		if (vanished.length > 0) return this.options.buildVanishedMessage(vanished);
		if (!this.options.buildReminderMessage || rows.length === 0) return undefined;

		const now = this.now();
		if (now - this.lastReminderAt < this.reminderIntervalMs) return undefined;
		this.lastReminderAt = now;
		return this.options.buildReminderMessage(rows);
	}
}

/** Narrow seam over pi.sendUserMessage -- real callers pass createAgentNotifier(pi); tests pass a
 * plain recording fake. Kept separate from the full ExtensionAPI type the same way other modules
 * in this package narrow ExtensionUIContext/ExtensionContext down to just what they use. */
export interface AgentNotifier {
	sendUserMessage(content: string, options?: { deliverAs?: "steer" | "followUp" }): void;
}

/** Binds a real ExtensionAPI as an AgentNotifier. A thin, literal forward -- reportAgentPollTick()
 * is what actually decides the delivery mode; this makes no policy choice of its own. */
export function createAgentNotifier(pi: ExtensionAPI): AgentNotifier {
	return { sendUserMessage: (content, options) => pi.sendUserMessage(content, options) };
}

/**
 * Runs one tick against `ticker` and, if it produced a message, delivers it through `notifier`.
 * Never throws: both a ticker bug and a notifier failure (e.g. a session mid-shutdown) are
 * swallowed, matching every confirmed caller's own best-effort widget/background-poll contract --
 * a background nudge must never crash the extension host it's running inside.
 *
 * Defaults to `deliverAs: "steer"`: always safe (delivered immediately when idle, queued for right
 * after the current turn's tool calls when streaming), unlike omitting `deliverAs` entirely, which
 * throws while streaming.
 */
export function reportAgentPollTick<Row>(
	ticker: AgentPollTicker<Row>,
	rows: readonly Row[],
	notifier: AgentNotifier | undefined,
	options: { deliverAs?: "steer" | "followUp" } = {},
): void {
	if (!notifier) return;
	let message: string | undefined;
	try {
		message = ticker.tick(rows);
	} catch {
		return;
	}
	if (!message) return;
	try {
		notifier.sendUserMessage(message, { deliverAs: options.deliverAs ?? "steer" });
	} catch {
		// Best-effort -- see this function's own doc comment.
	}
}
