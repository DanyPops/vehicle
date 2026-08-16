/**
 * The one-shot "resolve a connected client from a daemon's handle file, with an explicit
 * auto-start policy" helper. Split out of daemon-client.ts's own bundled concerns -- still zero
 * runtime imports of its own (see daemon-client.ts's own module doc comment for why that
 * invariant matters for Pi's jiti-based extension loader).
 */

/**
 * The one field every consumer's daemon handle shares: enough to know a
 * daemon is reachable and build a client against it. Consumers pass their
 * own richer handle type through structurally -- this only declares what
 * connectWithPolicy itself needs to read.
 */
export interface DaemonHandleLike {
	host: string;
	port: number;
	pid: number;
}

export interface ConnectPolicyOptions<Handle extends DaemonHandleLike, Client> {
	/** Reads the daemon's current handle file; null when not running or the file is stale/unreadable. */
	readHandle: () => Handle | null;
	/** Builds a connected client from a running daemon's handle (e.g. load the auth token and construct an RPC client). */
	buildClient: (handle: Handle) => Client | Promise<Client>;
	/**
	 * When false (default), no handle means fail closed with `fallbackMessage`
	 * -- the security-conscious default for a loopback-only daemon: nothing
	 * starts a new process on this caller's behalf unless explicitly asked.
	 * When true, `spawn` is called and connectWithPolicy polls for the
	 * handle file to appear.
	 */
	autoStart?: boolean;
	/**
	 * Starts the daemon process; required when autoStart is true. Expected to
	 * return immediately (detached + unref'd is the caller's responsibility)
	 * -- connectWithPolicy does its own polling, it does not await readiness
	 * from this call.
	 */
	spawn?: () => void;
	/** Actionable message used when no daemon is reachable and autoStart is false, or autoStart is true but the daemon never became reachable in time. */
	fallbackMessage: string;
	/** Bounded wait for the handle file to appear after spawn(), in ms. Defaults to 5000. */
	startTimeoutMs?: number;
	/** Poll interval while waiting for the handle file, in ms. Defaults to 100. */
	pollIntervalMs?: number;
}

/**
 * However many callers race to spawn() concurrently with no handle present
 * (N Pi sessions, or a human running `serve` twice by hand), only one
 * resulting daemon process ever binds a port and writes a handle -- that is
 * guaranteed daemon-side by startDaemon()'s single-instance lock (see
 * daemon.ts), not here. connectWithPolicy() itself needs no coordination:
 * every caller's poll-for-handle loop converges on whichever single daemon
 * actually won.
 *
 * Resolves a connected client from a daemon's handle file, applying one
 * explicit auto-start policy instead of the silent per-daemon fork this
 * house's four Pi extensions each picked independently (web-spider spawns
 * the daemon transparently; lector/papyrus/pi-packed fail closed with an
 * actionable error). `autoStart` defaults to false -- opt in explicitly,
 * consistent with these daemons' loopback-only, nothing-happens-by-default
 * security posture.
 */
export async function connectWithPolicy<Handle extends DaemonHandleLike, Client>(
	options: ConnectPolicyOptions<Handle, Client>,
): Promise<Client> {
	const handle = options.readHandle();
	if (handle) return options.buildClient(handle);

	if (!options.autoStart) throw new Error(options.fallbackMessage);
	if (!options.spawn) throw new Error("connectWithPolicy: autoStart is true but no spawn() was provided");
	options.spawn();

	const deadline = Date.now() + (options.startTimeoutMs ?? 5_000);
	const pollIntervalMs = options.pollIntervalMs ?? 100;
	while (Date.now() < deadline) {
		const started = options.readHandle();
		if (started) return options.buildClient(started);
		await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
	}
	throw new Error(options.fallbackMessage);
}
