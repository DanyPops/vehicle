/**
 * Retry budget + circuit breaker + createRetryingClient -- the retry-once-on-stale-connection
 * wrapper independently reimplemented in lector's `lectorClient()`, web-spider's
 * `callWebSpider()`, papyrus's `callService()`, and pi-packed's `createNatives()` before this
 * shared module existed. Split out of daemon-client.ts's own bundled concerns -- still zero
 * runtime imports of its own (see daemon-client.ts's own module doc comment for why that
 * invariant matters for Pi's jiti-based extension loader).
 */

import {
	type CallOnceOptions,
	type DaemonIdentityChange,
	type DaemonInstanceIdentity,
	isDefinitelyPreDispatchConnectionError,
	isLikelyStaleConnectionError,
	MutationOutcomeUnknownError,
	PreDispatchConnectionError,
	type StaleConnectionPredicate,
} from "./errors.js";

export interface CircuitBreakerState {
	/** True when call() is currently short-circuiting instead of attempting a real connect. */
	open: boolean;
	consecutiveFailures: number;
	/** Epoch ms the breaker last opened, or null if it has never opened (or was reset). */
	openedAt: number | null;
}

export interface RetryingClient<Client> {
	/**
	 * Runs `operation` against a connected client. On a stale-connection
	 * error, drops the cached client and retries `operation` exactly once
	 * against a freshly reconnected one; any other error, or a second
	 * consecutive failure, propagates immediately.
	 *
	 * When the circuit breaker is open (see CircuitBreakerOptions), call()
	 * rejects immediately with the last connect failure instead of attempting
	 * a new connect -- a daemon that is fundamentally broken (crash-loops,
	 * corrupt state, missing runtime dependency) would otherwise cost every
	 * single call() the full connect timeout before failing, repeatedly, for
	 * the rest of the session.
	 */
	call<T>(operation: (client: Client) => Promise<T>): Promise<T>;
	/**
	 * Like call(), but never retries `operation` itself after a failure --
	 * only the underlying connection is dropped (when the failure looks
	 * connection-shaped) so the *next* call()/callOnce() reconnects. Use this
	 * for a mutating/non-idempotent operation where transparently re-running
	 * it a second time after a transport failure could cause a duplicate
	 * side effect (e.g. Vehicle's own invoke()); call() remains right for a
	 * read-only or genuinely idempotent operation.
	 */
	callOnce<T>(operation: (client: Client) => Promise<T>, options?: CallOnceOptions): Promise<T>;
	/** Drops any cached client and resets the circuit breaker, forcing the next call() to reconnect. */
	reset(): void;
	/** Current breaker state, readable without triggering a live connect attempt. */
	breakerState(): CircuitBreakerState;
}

export interface CreateRetryingClientOptions {
	/** Defaults to isLikelyStaleConnectionError. */
	isStaleConnectionError?: StaleConnectionPredicate;
	/** Defaults to the deliberately conservative isDefinitelyPreDispatchConnectionError. */
	isPreDispatchConnectionError?: StaleConnectionPredicate;
	/** Re-resolved before every dispatch; a changed value invalidates the cached client before the operation runs. */
	resolveIdentity?: () => DaemonInstanceIdentity | Promise<DaemonInstanceIdentity>;
	/** Called after identity-triggered invalidation so consumers can clear process-local registrations. */
	onIdentityChange?: (change: DaemonIdentityChange) => void | Promise<void>;
	/** Used only in the retry-exhausted error message, e.g. "Lector". */
	label?: string;
	/**
	 * Fail-fast policy against a connect() that keeps failing. Pass `false` to
	 * disable entirely (unthrottled retry on every call(), the pre-existing
	 * behavior). Defaults to enabled with failureThreshold: 3, cooldownMs: 10_000.
	 */
	circuitBreaker?: CircuitBreakerOptions | false;
	/**
	 * Background retry budget around connect() itself -- the fix for a daemon that crashed and is
	 * mid-restart (systemd's Restart=on-failure/RestartSec, or Armada's own reconcile) rather than
	 * genuinely gone. Without this, a caller's very first call() during that window gets exactly one
	 * immediate reconnect attempt (see the `call()` doc comment) which almost always also fails --
	 * the replacement process hasn't finished starting yet -- and the error propagates all the way to
	 * whatever's calling the vehicle, telling a human to restart it by hand even though it was already
	 * on its way back up. `true` uses DEFAULT_CONNECT_RETRY (tuned to comfortably outlast one
	 * RestartSec=2 cycle plus real startup time); a full ConnectRetryOptions overrides it; omitted or
	 * `false` preserves the exact pre-existing single-attempt behavior. Only wraps connect() -- never
	 * retries operation(client) itself (see call()/callOnce()'s own, separate stale-connection retry),
	 * so a slow-to-fail in-flight request is never silently re-run.
	 */
	connectRetry?: ConnectRetryOptions | boolean;
	/**
	 * Fired at every internal retry/breaker decision point -- purely observational, never changes
	 * behavior. A caller hitting a scrubbed, deliberately generic error at some outer boundary (e.g.
	 * pi-pipes' withConnectorDiagnostics, which strips the raw cause/URL/token before it reaches a
	 * tool caller) otherwise has no way to RCA *why*: a genuine fresh connect() failure, a
	 * breaker-open short-circuit (no connect attempted at all this call), or an in-flight operation
	 * failure that triggered a stale-connection retry are all real, distinguishable causes that
	 * collapse into the same outer message today. Exceptions thrown from onEvent itself propagate --
	 * keep it synchronous and side-effect-light (e.g. a log line), never something that can fail.
	 */
	onEvent?: (event: RetryingClientDiagnosticEvent) => void;
}

export interface ConnectRetryOptions {
	/** Total attempts at connect(), including the first. Defaults to 6. */
	readonly attempts?: number;
	/** Delay before the second attempt. Defaults to 250ms. */
	readonly initialDelayMs?: number;
	/** No retry delay is ever allowed to exceed this. Defaults to 2000ms. */
	readonly maxDelayMs?: number;
	/** Multiplier applied to the delay after each failed attempt. Defaults to 1.8. */
	readonly growFactor?: number;
}

/**
 * Tuned to comfortably survive one systemd Restart=on-failure cycle (RestartSec=2 in every
 * Armada-managed unit -- see systemd.ts) plus real daemon startup time (handle file + health
 * endpoint), without making a genuinely-gone daemon's caller wait dramatically longer than
 * today's immediate failure. Worst case ~5s of delay (250+450+810+1458+2000ms across 5 retries
 * after the first attempt) before the pre-existing error surfaces exactly as it does today.
 */
export const DEFAULT_CONNECT_RETRY: Required<ConnectRetryOptions> = {
	attempts: 6,
	initialDelayMs: 250,
	maxDelayMs: 2000,
	growFactor: 1.8,
};

function resolveConnectRetry(option: ConnectRetryOptions | boolean | undefined): Required<ConnectRetryOptions> | undefined {
	if (!option) return undefined;
	if (option === true) return DEFAULT_CONNECT_RETRY;
	return { ...DEFAULT_CONNECT_RETRY, ...option };
}

/** Same jittered exponential-backoff formula as versionCheckRetryDelayMs/connectPushChannel's
 * reconnect delay -- kept as its own copy per this file's "no imports of its own" invariant. */
function connectRetryDelayMs(attempt: number, options: Required<ConnectRetryOptions>): number {
	const raw = Math.min(options.initialDelayMs * options.growFactor ** (attempt - 1), options.maxDelayMs);
	return raw * (0.8 + Math.random() * 0.4); // +/-20% jitter
}

async function connectWithRetryBudget<Client>(
	connect: () => Promise<Client>,
	options: Required<ConnectRetryOptions>,
	onEvent?: (event: RetryingClientDiagnosticEvent) => void,
): Promise<Client> {
	for (let attempt = 1; ; attempt++) {
		try {
			return await connect();
		} catch (error) {
			if (attempt >= options.attempts) throw error;
			onEvent?.({ type: "connect-retry", error, attempt });
			await new Promise((resolve) => setTimeout(resolve, connectRetryDelayMs(attempt, options)));
		}
	}
}

/**
 * One retry/breaker decision, in the order they can occur:
 *  - connect-success / connect-failure: a real connect() attempt just resolved or rejected --
 *    connect-failure fires only once per logical connect (i.e. after connectRetry's own budget,
 *    if any, is exhausted), never once per internal sub-attempt.
 *  - connect-retry: connectRetry is enabled and a connect() sub-attempt just failed with another
 *    attempt still budgeted -- fires before each backoff delay, never on the final exhausted one.
 *  - breaker-open-short-circuit: call()/callOnce() rejected immediately from the breaker's last
 *    recorded failure, without attempting a new connect() at all this call.
 *  - stale-connection-retry: call() saw a stale-connection error from operation(client) and is
 *    about to drop the connection and retry once against a fresh one.
 *  - pre-dispatch-retry: callOnce() saw an error proving dispatch never began (ECONNREFUSED-shaped)
 *    and is transparently retrying once, with no risk of a duplicate side effect.
 *  - pre-dispatch-exhausted: callOnce()'s transparent pre-dispatch retry itself also failed;
 *    surfacing as PreDispatchConnectionError.
 *  - mutation-outcome-unknown: callOnce() saw an ambiguous transport failure (dispatch may or may
 *    not have reached the daemon) and is surfacing MutationOutcomeUnknownError without retrying.
 */
export interface RetryingClientDiagnosticEvent {
	type:
		| "connect-success"
		| "connect-failure"
		| "connect-retry"
		| "breaker-open-short-circuit"
		| "stale-connection-retry"
		| "pre-dispatch-retry"
		| "pre-dispatch-exhausted"
		| "mutation-outcome-unknown";
	/** The raw underlying error, never scrubbed -- present on every event except connect-success. */
	error?: unknown;
	/** 0-indexed attempt number within the current call()/callOnce() invocation, when applicable. */
	attempt?: number;
	/** Present only on breaker-open-short-circuit -- the breaker's own consecutive-failure count that tripped it. */
	consecutiveFailures?: number;
	/** Present only when the caller supplied one to callOnce(). */
	operationId?: string;
}

export interface CircuitBreakerOptions {
	/** Consecutive connect() failures before call() starts short-circuiting. Defaults to 3. */
	failureThreshold?: number;
	/** How long the breaker stays open before allowing one probe attempt through. Defaults to 10_000ms. */
	cooldownMs?: number;
}

class CircuitBreaker {
	private consecutiveFailures = 0;
	private openedAt: number | null = null;
	private lastError: unknown;

	constructor(
		private readonly failureThreshold: number,
		private readonly cooldownMs: number,
	) {}

	/** False once cooldownMs has elapsed since opening -- that lets exactly one probe attempt through (half-open). */
	isOpen(): boolean {
		if (this.openedAt === null) return false;
		return Date.now() - this.openedAt < this.cooldownMs;
	}

	recordFailure(error: unknown): void {
		this.consecutiveFailures++;
		this.lastError = error;
		if (this.consecutiveFailures >= this.failureThreshold) this.openedAt = Date.now();
	}

	recordSuccess(): void {
		this.consecutiveFailures = 0;
		this.openedAt = null;
		this.lastError = undefined;
	}

	reset(): void {
		this.recordSuccess();
	}

	lastFailure(): unknown {
		return this.lastError;
	}

	state(): CircuitBreakerState {
		return { open: this.isOpen(), consecutiveFailures: this.consecutiveFailures, openedAt: this.openedAt };
	}
}

const NULL_BREAKER: Pick<CircuitBreaker, "isOpen" | "recordFailure" | "recordSuccess" | "reset" | "lastFailure" | "state"> = {
	isOpen: () => false,
	recordFailure: () => {},
	recordSuccess: () => {},
	reset: () => {},
	lastFailure: () => undefined,
	state: () => ({ open: false, consecutiveFailures: 0, openedAt: null }),
};

/**
 * Wraps `connect` (typically a function that reads a daemon's handle file,
 * loads its auth token, and constructs an RPC client) with the caching and
 * retry policy every one of this house's Pi extensions already needed. A
 * failed connection attempt is never cached, so the very next call retries
 * once the daemon is actually reachable.
 */
export function createRetryingClient<Client>(
	connect: () => Promise<Client>,
	options: CreateRetryingClientOptions = {},
): RetryingClient<Client> {
	const isStale = options.isStaleConnectionError ?? isLikelyStaleConnectionError;
	const isPreDispatch = options.isPreDispatchConnectionError ?? isDefinitelyPreDispatchConnectionError;
	const label = options.label ?? "daemon";
	const breaker =
		options.circuitBreaker === false
			? NULL_BREAKER
			: new CircuitBreaker(options.circuitBreaker?.failureThreshold ?? 3, options.circuitBreaker?.cooldownMs ?? 10_000);
	const connectRetry = resolveConnectRetry(options.connectRetry);
	let generation = 0;
	let cached: { promise: Promise<Client>; generation: number } | undefined;
	let currentIdentity: DaemonInstanceIdentity | undefined;

	function invalidateGeneration(usedGeneration: number): void {
		if (cached?.generation === usedGeneration) {
			cached = undefined;
			generation++;
		}
	}

	async function prepareIdentity(): Promise<void> {
		if (!options.resolveIdentity) return;
		const resolved = await options.resolveIdentity();
		if (currentIdentity === undefined) {
			currentIdentity = resolved;
			return;
		}
		if (resolved === currentIdentity) return;
		const previous = currentIdentity;
		currentIdentity = resolved;
		cached = undefined;
		generation++;
		breaker.reset();
		await options.onIdentityChange?.({ previous, current: resolved });
	}

	function resolveClient(): { promise: Promise<Client>; generation: number } {
		if (!cached) {
			const createdGeneration = generation;
			const promise = (connectRetry ? connectWithRetryBudget(connect, connectRetry, options.onEvent) : connect())
				.then((client) => {
					breaker.recordSuccess();
					options.onEvent?.({ type: "connect-success" });
					return client;
				})
				.catch((error: unknown) => {
					invalidateGeneration(createdGeneration);
					breaker.recordFailure(error);
					options.onEvent?.({ type: "connect-failure", error });
					throw error;
				});
			cached = { promise, generation: createdGeneration };
		}
		return cached;
	}

	return {
		async call(operation) {
			for (let attempt = 0; attempt < 2; attempt++) {
				await prepareIdentity();
				if (breaker.isOpen()) {
					const lastFailure = breaker.lastFailure();
					options.onEvent?.({
						type: "breaker-open-short-circuit",
						error: lastFailure,
						consecutiveFailures: breaker.state().consecutiveFailures,
					});
					throw lastFailure;
				}
				const resolved = resolveClient();
				const client = await resolved.promise;
				try {
					return await operation(client);
				} catch (error) {
					if (!isStale(error)) throw error;
					invalidateGeneration(resolved.generation);
					if (attempt === 1) throw error;
					options.onEvent?.({ type: "stale-connection-retry", error, attempt });
				}
			}
			// Unreachable with the current fixed 2-attempt bound -- attempt 1's
			// catch above always either returns or throws. Kept as a labeled
			// safety net rather than a non-null assertion, in case that bound
			// ever becomes configurable.
			throw new Error(`${label} client retry exhausted`);
		},
		async callOnce(operation, callOptions = {}) {
			for (let attempt = 0; attempt < 2; attempt++) {
				await prepareIdentity();
				if (breaker.isOpen()) {
					const lastFailure = breaker.lastFailure();
					options.onEvent?.({
						type: "breaker-open-short-circuit",
						error: lastFailure,
						consecutiveFailures: breaker.state().consecutiveFailures,
						operationId: callOptions.operationId,
					});
					throw lastFailure;
				}
				const resolved = resolveClient();
				const client = await resolved.promise;
				try {
					return await operation(client);
				} catch (error) {
					if (!isStale(error)) throw error;
					invalidateGeneration(resolved.generation);
					if (isPreDispatch(error)) {
						if (attempt === 0) {
							options.onEvent?.({ type: "pre-dispatch-retry", error, attempt, operationId: callOptions.operationId });
							continue;
						}
						options.onEvent?.({ type: "pre-dispatch-exhausted", error, attempt, operationId: callOptions.operationId });
						throw new PreDispatchConnectionError(callOptions.operationId, error);
					}
					if (error instanceof Error && error.name === "AbortError") throw error;
					options.onEvent?.({ type: "mutation-outcome-unknown", error, attempt, operationId: callOptions.operationId });
					throw new MutationOutcomeUnknownError(callOptions.operationId, error);
				}
			}
			throw new Error(`${label} client retry exhausted`);
		},
		reset() {
			cached = undefined;
			generation++;
			breaker.reset();
		},
		breakerState() {
			return breaker.state();
		},
	};
}
