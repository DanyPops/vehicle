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
 * createAgentNotifier()/reportAgentPollTick() are the other half: the actual delivery, via
 * pi.sendMessage() (a custom message, distinct from pi.sendUserMessage() -- see
 * AgentNotifier's own doc comment for why). Defaults to deliverAs: "followUp" -- gentle by
 * design: unlike pi.sendUserMessage() (which always triggers a turn, immediately when idle, no
 * way to opt out), pi.sendMessage()'s own deliverAs modes only force an immediate turn when
 * triggerTurn is explicitly set true, which this never does -- a background poll's own nudge
 * waits for the agent to naturally have no more pending tool calls instead of interrupting one.
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

/** Narrow seam over pi.sendMessage() -- real callers pass createAgentNotifier(pi); tests pass a
 * plain recording fake. Kept separate from the full ExtensionAPI type the same way other modules
 * in this package narrow ExtensionUIContext/ExtensionContext down to just what they use.
 *
 * Named sendUserMessage (and shaped as a plain string + deliverAs, not sendMessage's own
 * {customType, content, display} object) for source stability across the rename underneath it --
 * every existing caller/test double constructing a plain {sendUserMessage} fake keeps working
 * unchanged. What actually changed is createAgentNotifier()'s own real implementation below: it
 * now forwards to pi.sendMessage(), not pi.sendUserMessage() -- a background poll's own nudge is
 * not "as if typed by the user", and sendMessage is the gentler, non-turn-forcing API (see this
 * file's own top doc comment). */
export interface AgentNotifier {
	sendUserMessage(content: string, options?: { deliverAs?: "steer" | "followUp" }): void;
}

/** Binds a real ExtensionAPI as an AgentNotifier, via pi.sendMessage() -- see AgentNotifier's own
 * doc comment for why this isn't pi.sendUserMessage(). reportAgentPollTick() is what actually
 * decides the delivery mode; this makes no policy choice of its own beyond the API it forwards to. */
export function createAgentNotifier(pi: ExtensionAPI): AgentNotifier {
	return {
		sendUserMessage: (content, options) =>
			void pi.sendMessage({ customType: "vehicle-client-pi:agent-poll-ticker", content, display: true }, options),
	};
}

/**
 * Runs one tick against `ticker` and, if it produced a message, delivers it through `notifier`.
 * Never throws: both a ticker bug and a notifier failure (e.g. a session mid-shutdown) are
 * swallowed, matching every confirmed caller's own best-effort widget/background-poll contract --
 * a background nudge must never crash the extension host it's running inside.
 *
 * Defaults to `deliverAs: "followUp"`: gentle by design, since createAgentNotifier() now forwards
 * to pi.sendMessage() rather than pi.sendUserMessage() -- see this file's own top doc comment for
 * why that default no longer needs to be "steer" (sendUserMessage's own always-triggers-a-turn
 * footgun this default used to work around).
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
		notifier.sendUserMessage(message, { deliverAs: options.deliverAs ?? "followUp" });
	} catch {
		// Best-effort -- see this function's own doc comment.
	}
}
