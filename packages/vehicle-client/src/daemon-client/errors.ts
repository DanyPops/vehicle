/**
 * Connection-error classification + the two typed failures createRetryingClient's callOnce()
 * surfaces for a mutating operation. Split out of daemon-client.ts's own bundled concerns --
 * still zero runtime imports of its own (see daemon-client.ts's own module doc comment for why
 * that invariant matters for Pi's jiti-based extension loader).
 */

export type StaleConnectionPredicate = (error: unknown) => boolean;

/** Opaque identity for one daemon process instance. Never use a bearer token as this value. */
export type DaemonInstanceIdentity = string & { readonly __daemonInstanceIdentity: unique symbol };

export function daemonInstanceIdentity(value: string): DaemonInstanceIdentity {
	if (!value) throw new Error("daemon instance identity must not be empty");
	return value as DaemonInstanceIdentity;
}

export interface DaemonIdentityChange {
	previous: DaemonInstanceIdentity;
	current: DaemonInstanceIdentity;
}

export interface CallOnceOptions {
	/** Stable request/tool-call identifier carried into typed transport-ambiguity failures. */
	operationId?: string;
}

export class PreDispatchConnectionError extends Error {
	readonly code = "vehicle-pre-dispatch-connection-failed";
	constructor(
		readonly operationId: string | undefined,
		cause: unknown,
	) {
		super(
			`connection failed before dispatch${operationId ? ` (${operationId})` : ""}: ${cause instanceof Error ? cause.message : String(cause)}`,
			{
				cause,
			},
		);
		this.name = "PreDispatchConnectionError";
	}
}

export class MutationOutcomeUnknownError extends Error {
	readonly code = "vehicle-mutation-outcome-unknown";
	constructor(
		readonly operationId: string | undefined,
		cause: unknown,
	) {
		super(
			`operation outcome is unknown${operationId ? ` (${operationId})` : ""}: ${cause instanceof Error ? cause.message : String(cause)}`,
			{
				cause,
			},
		);
		this.name = "MutationOutcomeUnknownError";
	}
}

const DEFINITELY_PRE_DISPATCH_CODES = new Set(["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ENETUNREACH", "EHOSTUNREACH"]);

/**
 * Conservative classifier for failures proving no request reached the daemon. A bare
 * `fetch failed`, timeout, reset, or abort is deliberately excluded: those can happen
 * after the server applied a mutation but before the response reached the caller.
 */
export function isDefinitelyPreDispatchConnectionError(error: unknown): boolean {
	let current: unknown = error;
	for (let depth = 0; depth < 5 && current instanceof Error; depth++) {
		const code = (current as Error & { code?: unknown }).code;
		if (typeof code === "string" && DEFINITELY_PRE_DISPATCH_CODES.has(code)) return true;
		current = current.cause;
	}
	return false;
}

/**
 * True when `error` means the connection itself is bad (worth dropping the
 * cached client and retrying once against a fresh one) -- a dead port after
 * a daemon restart, a refused/reset socket, a DNS failure, a timed-out
 * request. False for a genuine domain-level rejection (e.g. a validation
 * error the daemon itself returned), which a retry cannot fix and would
 * only mask. Matches the heuristic already proven identical across every
 * consumer this module replaces.
 */
export function isLikelyStaleConnectionError(error: unknown): boolean {
	if (error instanceof TypeError) return true; // fetch()'s own connection-refused/DNS-failure shape
	if (!(error instanceof Error)) return false;
	if (error.name === "AbortError" || error.name === "TimeoutError") return true;
	return /fetch failed|unable to connect|network|socket|ECONNRESET|ECONNREFUSED|connection refused/i.test(error.message);
}
