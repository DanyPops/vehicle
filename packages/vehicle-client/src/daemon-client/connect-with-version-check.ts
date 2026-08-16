/**
 * connectWithPolicy plus a one-time version handshake that transparently replaces a stale
 * daemon. Split out of daemon-client.ts's own bundled concerns -- still zero runtime imports
 * outside this package's own daemon-client/* siblings (see daemon-client.ts's own module doc
 * comment for why that invariant matters for Pi's jiti-based extension loader).
 */

import { type ConnectPolicyOptions, connectWithPolicy, type DaemonHandleLike } from "./connect-with-policy.js";

/**
 * A plain string is fine for a genuinely fixed/compiled version. Everything else should pass a
 * supplier instead: a plain string can never be "fresh" by construction, so caching one read
 * once at module load (the natural, obvious way to read "my own version") goes stale the
 * moment `npm update` rewrites package.json underneath an already-running process -- every
 * later connect then sees a permanent, never-self-healing false mismatch. See
 * createLiveVersionExpectation() (./version.ts) for the correct always-fresh supplier.
 */
export type ExpectedVersion = string | (() => string) | (() => Promise<string>);

export interface VersionCheckOptions<Handle extends DaemonHandleLike, Client> {
	/** This extension's own expected daemon version/protocol identifier. Resolved fresh on every call -- see ExpectedVersion. */
	expectedVersion: ExpectedVersion;
	/** Reads the connected daemon's reported version (e.g. via its /health response). A connection failure here is retried -- see connectRetry -- rather than propagated as-is; every other error still propagates unchanged, and an inconclusive read never triggers a kill. */
	readVersion: (client: Client) => Promise<string>;
	/** Best-effort graceful shutdown request against the stale daemon. Its failure is swallowed -- killStaleProcess is the real fallback that must always work. */
	requestShutdown?: (client: Client) => Promise<void>;
	/** Hard fallback: signal the stale daemon's process directly (e.g. `process.kill(handle.pid, "SIGTERM")`). Must not throw for an already-dead pid. */
	killStaleProcess: (handle: Handle) => void;
	/** Bounded wait for the stale daemon's handle file to clear after shutdown/kill, before spawning its replacement. Defaults to 2000ms. */
	shutdownTimeoutMs?: number;
	/** Poll interval while waiting for the handle file to clear. Defaults to 50ms. */
	shutdownPollIntervalMs?: number;
	/**
	 * Bounded retry/backoff around the initial connect+readVersion round trip -- closes a real
	 * TOCTOU race: two concurrent callers can both connect to the same stale daemon, but only
	 * one needs to actually kill it -- every other in-flight caller's own readVersion() then
	 * hits a connection freshly closed out from under it and would otherwise throw, even though
	 * the daemon is being correctly replaced. Retrying re-reads the handle fresh each attempt,
	 * so it picks up whatever the current real state is (often an already-live replacement)
	 * instead of propagating a transient failure that was never a real problem. Modeled on
	 * connectPushChannel's own reconnect backoff. Sized larger than vehicle-client-pi's
	 * registerVehicleTools handshake retry (which closes the analogous race one layer up, but
	 * only needs to survive a daemon's ~100-300ms cold boot): this retry must survive a whole
	 * concurrent kill-wait-respawn cycle, which shutdownTimeoutMs alone allows up to 2000ms for.
	 * Defaults to attempts:8, initialDelayMs:100, maxDelayMs:1000, growFactor:1.8 (~5.2s worst
	 * case). Set attempts:1 to restore the old immediate-failure behavior exactly.
	 */
	connectRetry?: ConnectVersionCheckRetryOptions;
}

export interface ConnectVersionCheckRetryOptions {
	/** Total attempts at the connect+readVersion round trip, including the first. Defaults to 4. */
	readonly attempts?: number;
	/** Delay before the second attempt. Defaults to 50ms. */
	readonly initialDelayMs?: number;
	/** No retry delay is ever allowed to exceed this. Defaults to 500ms. */
	readonly maxDelayMs?: number;
	/** Multiplier applied to the delay after each failed attempt. Defaults to 2.5. */
	readonly growFactor?: number;
}

/**
 * Dependency-free dotted-numeric version comparator (no semver package -- this file
 * deliberately has no imports of its own, see the module doc comment). Compares segments
 * numerically ("0.44.12" < "0.45.0"); a non-numeric segment on either side falls back to a
 * plain string comparison of that segment, which is still deterministic, just not
 * semver-aware (pre-release tags, build metadata). Missing trailing segments compare as 0
 * ("1.2" === "1.2.0"). Returns negative/zero/positive like Array.prototype.sort's comparator.
 */
export function compareVersions(a: string, b: string): number {
	const partsA = a.split(".");
	const partsB = b.split(".");
	const length = Math.max(partsA.length, partsB.length);
	for (let i = 0; i < length; i++) {
		const rawA = partsA[i] ?? "0";
		const rawB = partsB[i] ?? "0";
		const numA = Number(rawA);
		const numB = Number(rawB);
		if (Number.isFinite(numA) && Number.isFinite(numB)) {
			if (numA !== numB) return numA - numB;
		} else if (rawA !== rawB) {
			return rawA < rawB ? -1 : 1;
		}
	}
	return 0;
}

/** Same jittered exponential-backoff formula as connectPushChannel's reconnect delay,
 * duplicated locally rather than shared since this file deliberately has no imports of its
 * own (see the module doc comment). */
function versionCheckRetryDelayMs(attempt: number, initialDelayMs: number, maxDelayMs: number, growFactor: number): number {
	const raw = Math.min(initialDelayMs * growFactor ** (attempt - 1), maxDelayMs);
	return raw * (0.8 + Math.random() * 0.4); // +/-20% jitter
}

async function connectAndReadVersionWithRetry<Handle extends DaemonHandleLike, Client>(
	policy: ConnectPolicyOptions<Handle, Client>,
	versionCheck: VersionCheckOptions<Handle, Client>,
): Promise<{ client: Client; runningVersion: string }> {
	const attempts = versionCheck.connectRetry?.attempts ?? 8;
	const initialDelayMs = versionCheck.connectRetry?.initialDelayMs ?? 100;
	const maxDelayMs = versionCheck.connectRetry?.maxDelayMs ?? 1_000;
	const growFactor = versionCheck.connectRetry?.growFactor ?? 1.8;

	for (let attempt = 1; ; attempt++) {
		try {
			const client = await connectWithPolicy(policy);
			const runningVersion = await versionCheck.readVersion(client);
			return { client, runningVersion };
		} catch (error) {
			if (attempt >= attempts) throw error;
			await new Promise((resolve) => setTimeout(resolve, versionCheckRetryDelayMs(attempt, initialDelayMs, maxDelayMs, growFactor)));
		}
	}
}

/**
 * Wraps connectWithPolicy with a one-time version handshake: an
 * auto-spawned daemon can outlive the extension package that spawned it --
 * `pi update` upgrades the npm package on disk, but a daemon process
 * started yesterday keeps running with yesterday's code until something
 * notices. Left alone, the client silently talks to a stale daemon whose
 * wire protocol or schema may no longer match what this session expects.
 *
 * On every fresh connect (a new client instance, not a cached call), the
 * daemon's reported version is checked against `expectedVersion`, compared
 * with compareVersions (not string equality, so "which one is newer" is a
 * real, ordered question, not just a difference):
 * - Equal (or equal by comparison, e.g. "1.2" vs "1.2.0"): plain
 *   connectWithPolicy's path, no extra latency beyond one readVersion() call.
 * - Running is OLDER than expected: this is the genuine staleness case
 *   (`npm update` ran, the daemon didn't restart) -- replaced transparently
 *   (graceful shutdown request, falling back to a direct kill signal),
 *   reconnects against a freshly spawned one, no error surfaces.
 * - Running is NEWER than expected: this caller is the stale side, not the
 *   daemon. Two different installed copies of the same consumer package can
 *   coexist (a hoisted top-level copy plus another package's own undeduped
 *   nested copy) and each resolve a different expectedVersion from their own
 *   package.json -- without this direction check, they would kill and
 *   respawn the daemon back and forth forever, each "fixing" what the other
 *   had just "fixed". Refuses instead: never downgrades a live daemon, the
 *   caller gets an actionable error naming the version to upgrade to.
 */
export async function connectWithVersionCheck<Handle extends DaemonHandleLike, Client>(
	policy: ConnectPolicyOptions<Handle, Client>,
	versionCheck: VersionCheckOptions<Handle, Client>,
): Promise<Client> {
	const { client, runningVersion } = await connectAndReadVersionWithRetry(policy, versionCheck);
	const expectedVersion =
		typeof versionCheck.expectedVersion === "function" ? await versionCheck.expectedVersion() : versionCheck.expectedVersion;
	const comparison = compareVersions(runningVersion, expectedVersion);
	if (comparison === 0) return client;

	if (comparison > 0) {
		throw new Error(
			`daemon is running a newer version (${runningVersion}) than this client expects (${expectedVersion}) -- upgrade this package to at least ${runningVersion} and retry; refusing to downgrade the running daemon`,
		);
	}

	// Without a spawn() a replacement can never come back -- killing the
	// stale daemon here would leave the caller with nothing at all, strictly
	// worse than a detected-but-unreplaced version mismatch. Surface that
	// plainly instead of silently leaving either a dead or a stale daemon.
	if (!policy.spawn) {
		throw new Error(
			`stale daemon detected (running ${runningVersion}, expected ${expectedVersion}) but no spawn() is configured to replace it -- restart the daemon manually`,
		);
	}

	const staleHandle = policy.readHandle();
	if (versionCheck.requestShutdown) {
		try {
			await versionCheck.requestShutdown(client);
		} catch {
			// Best-effort only -- killStaleProcess below is the real guarantee.
		}
	}
	if (staleHandle) versionCheck.killStaleProcess(staleHandle);

	const deadline = Date.now() + (versionCheck.shutdownTimeoutMs ?? 2_000);
	const pollIntervalMs = versionCheck.shutdownPollIntervalMs ?? 50;
	while (Date.now() < deadline && policy.readHandle()) {
		await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
	}

	return connectWithPolicy({ ...policy, autoStart: true });
}
