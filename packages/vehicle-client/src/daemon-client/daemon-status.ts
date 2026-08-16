/**
 * daemonStatus -- the "is a daemon running, which version, since when, is it healthy" diagnostic
 * surface every consumer's CLI exposes as `<name> status`. Split out of daemon-client.ts's own
 * bundled concerns -- still zero runtime imports outside this package's own daemon-client/*
 * siblings (see daemon-client.ts's own module doc comment for why that invariant matters for
 * Pi's jiti-based extension loader).
 */

import type { DaemonHandleLike } from "./connect-with-policy.js";
import type { CircuitBreakerState } from "./retrying-client.js";

export type DaemonStatusState = "running" | "not-running" | "stale-handle" | "unreachable";

export interface DaemonStatus {
	state: DaemonStatusState;
	pid?: number;
	version?: string;
	uptimeMs?: number;
	breaker?: CircuitBreakerState;
	/** Set only for state "unreachable" -- the error the connect/version-read attempt raised. */
	lastError?: string;
	/** One human-readable line, safe to print as-is; every other field is the machine-readable detail behind it. */
	summary: string;
}

export interface DaemonStatusOptions<Handle extends DaemonHandleLike, Client> {
	readHandle: () => Handle | null;
	buildClient: (handle: Handle) => Client | Promise<Client>;
	/** Optional -- e.g. reads the daemon's /health response. Omit to report liveness without a version. */
	readVersion?: (client: Client) => Promise<string>;
	/** Optional -- computes uptime from whatever the handle/caller already tracks (this module does not itself define where a start timestamp lives). */
	startedAtMs?: (handle: Handle) => number | undefined;
	/** Reports a createRetryingClient's breakerState() inline, so "why is nothing happening" and "is the breaker open" are answered by one call. */
	breaker?: () => CircuitBreakerState;
	/** Defaults to process.kill(pid, 0)/EPERM-is-alive semantics. Injectable for tests. */
	isPidAlive?: (pid: number) => boolean;
}

function defaultIsPidAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		// EPERM means the process exists but we lack permission to signal it --
		// still alive. Any other error (ESRCH, or an invalid pid) means it is not.
		return (error as NodeJS.ErrnoException).code === "EPERM";
	}
}

/**
 * Answers "is a daemon running, which version, since when, is it healthy"
 * without the user (or the extension debugging on their behalf) needing to
 * read the handle file or run `ps` by hand -- the one diagnostic surface
 * every consumer's CLI can expose as `<name> status` for parity with the
 * rest of this house's daemon-backed CLIs.
 */
export async function daemonStatus<Handle extends DaemonHandleLike, Client>(
	options: DaemonStatusOptions<Handle, Client>,
): Promise<DaemonStatus> {
	const breaker = options.breaker?.();
	const handle = options.readHandle();
	if (!handle) return { state: "not-running", breaker, summary: "not running" };

	const isPidAlive = options.isPidAlive ?? defaultIsPidAlive;
	if (!isPidAlive(handle.pid)) {
		return { state: "stale-handle", pid: handle.pid, breaker, summary: `stale handle file -- pid ${handle.pid} is not running` };
	}

	const uptimeMs = options.startedAtMs ? Date.now() - (options.startedAtMs(handle) ?? Date.now()) : undefined;
	try {
		const client = await options.buildClient(handle);
		const version = options.readVersion ? await options.readVersion(client) : undefined;
		const versionSuffix = version ? `, v${version}` : "";
		return { state: "running", pid: handle.pid, version, uptimeMs, breaker, summary: `running (pid ${handle.pid}${versionSuffix})` };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			state: "unreachable",
			pid: handle.pid,
			uptimeMs,
			breaker,
			lastError: message,
			summary: `process is alive (pid ${handle.pid}) but not responding: ${message}`,
		};
	}
}
