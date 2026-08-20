/**
 * Coalesces a burst of calls for the same key into exactly one callback fire,
 * delayMs after the last call for that key -- the classic debounce shape,
 * useful anywhere a flurry of raw upstream events for one logical unit of
 * work (a filesystem save that fires more than once via temp-file write +
 * atomic rename, a burst of webhook deliveries for the same resource) needs
 * to collapse into a single downstream action. Different keys are fully
 * independent. Pure timer bookkeeping, no I/O -- the callback itself does
 * whatever real work is needed.
 */

/** The minimal logging surface this module needs -- any real Logger (e.g. Vehicle's own daemon Logger) satisfies this structurally, no adapter required. */
export interface MinimalLogger {
	debug(msg: string, fields?: Record<string, unknown>): void;
	warn(msg: string, fields?: Record<string, unknown>): void;
}

export class DebounceCapacityExceeded extends Error {
	constructor(
		readonly key: string,
		readonly max: number,
	) {
		super(`debounced scheduler distinct-key bound exceeded (${max}) scheduling key "${key}"`);
		this.name = "DebounceCapacityExceeded";
	}
}

export interface DebouncedSchedulerOptions {
	/** Maximum distinct keys with a pending fire at once. Default 4096. */
	readonly maxKeys?: number;
	readonly logger?: MinimalLogger;
}

const DEFAULT_MAX_KEYS = 4096;
const NOOP_LOGGER: MinimalLogger = { debug() {}, warn() {} };

export class DebouncedScheduler {
	private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
	private readonly delayMs: number;
	private readonly maxKeys: number;
	private readonly logger: MinimalLogger;

	constructor(delayMs: number, options: DebouncedSchedulerOptions = {}) {
		if (!Number.isSafeInteger(delayMs) || delayMs < 0) throw new TypeError("delayMs must be a non-negative safe integer");
		this.delayMs = delayMs;
		this.maxKeys = options.maxKeys ?? DEFAULT_MAX_KEYS;
		this.logger = options.logger ?? NOOP_LOGGER;
	}

	/**
	 * Schedules `callback` to run delayMs after this call, resetting any pending fire already
	 * scheduled for `key`. A callback that throws or rejects is caught and dropped -- there is
	 * no request awaiting this fire to report the error, and an unhandled timer failure would
	 * otherwise crash the whole process rather than just this one key's work.
	 * A caller that cares about its own errors should catch and log inside `callback` itself.
	 */
	schedule(key: string, callback: () => unknown): void {
		const existing = this.timers.get(key);
		if (existing) {
			clearTimeout(existing);
			this.logger.debug("debounced schedule coalesced", { component: "debounced-scheduler", operation: "schedule" });
		} else if (this.timers.size >= this.maxKeys) {
			this.logger.warn("debounced schedule rejected", {
				component: "debounced-scheduler",
				operation: "schedule",
				code: "DebounceCapacityExceeded",
			});
			throw new DebounceCapacityExceeded(key, this.maxKeys);
		}
		const reportFailure = (error: unknown): void => {
			this.logger.warn("debounced callback failed", {
				component: "debounced-scheduler",
				operation: "fire",
				code: error instanceof Error ? error.name || "Error" : "Error",
			});
		};
		const timer = setTimeout(() => {
			this.timers.delete(key);
			try {
				Promise.resolve(callback()).catch(reportFailure);
			} catch (error: unknown) {
				reportFailure(error);
			}
		}, this.delayMs);
		this.timers.set(key, timer);
	}

	/** Cancels `key`'s pending fire, if any. Idempotent -- an unknown or already-fired key is a safe no-op. */
	cancel(key: string): void {
		const existing = this.timers.get(key);
		if (!existing) return;
		clearTimeout(existing);
		this.timers.delete(key);
	}

	/** True while `key` has a fire pending. */
	has(key: string): boolean {
		return this.timers.has(key);
	}

	/** Cancels every pending key at once -- for clean shutdown. */
	clear(): void {
		for (const timer of this.timers.values()) clearTimeout(timer);
		this.timers.clear();
	}
}
