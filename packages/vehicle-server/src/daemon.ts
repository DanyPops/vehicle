/**
 * Composition-root helper for a supervised, loopback-only daemon --
 * Bun-native (Bun.serve) or plain Node (node:http), runtime-detected
 * exactly like storage.ts already does for SQLite (bun:sqlite vs
 * node:sqlite via openRawDatabase). Generalizes the skeleton that was
 * identical (bind port 0, write the handle only after a successful bind,
 * run periodic maintenance timers, clean SIGINT/SIGTERM shutdown) across
 * web-spider-daemon, jittor, and papyrus's daemon.ts -- two of which said
 * so in their own header comments.
 *
 * Mirrors jittor's own startDaemon()/serveMain() split, the most testable
 * of the four originals: startDaemon() does no process-level I/O beyond
 * binding a listener itself and returns a stoppable handle; runDaemonProcess()
 * adds the SIGINT/SIGTERM registration and process.exit for the real binary.
 *
 * startDaemon() is async under both runtimes -- Bun.serve() binds
 * synchronously, but node:http's listen() does not (the OS-assigned port
 * is only known once the 'listening' event fires), and this file has
 * exactly one entry point rather than a second parallel one callers must
 * choose between, so the Bun path pays the (negligible) cost of being
 * wrapped in a resolved Promise too.
 *
 * No consumer imports this module's startDaemon() directly outside this
 * package's own tests today, so this is not a breaking change to any real
 * caller -- confirmed directly, not assumed, before making the signature
 * change.
 */
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { startBunListener } from "./daemon/bun-listener.ts";
import { startNodeListener } from "./daemon/node-listener.ts";
import type { DaemonLifecycleLog } from "./daemon-lifecycle.ts";
import type { Logger } from "./logging.ts";
import {
	acquireDaemonLock,
	acquireDaemonLockAsService,
	LOOPBACK_HOST,
	type ReclaimDeps,
	releaseDaemonLock,
	removeDaemonHandle,
	resolveSharedVehicleHandlePath,
	writeDaemonHandle,
} from "./paths.ts";
import type { PushChannel } from "./push-channel.ts";

const isBun = typeof Bun !== "undefined";

/**
 * Thrown by startDaemon() when another live process already holds the
 * single-instance lock. This is a normal join, not a failure -- exactly one
 * daemon should ever be bound at a time regardless of how many callers
 * raced to start one, so runDaemonProcess() catches this specifically and
 * exits 0 rather than crashing.
 */
export class DaemonAlreadyRunningError extends Error {
	readonly holderPid: number | null;

	// Not a TypeScript parameter-property constructor (`constructor(public readonly holderPid...)`) --
	// that shorthand isn't erasable syntax, and Node's own native type-stripping (no build step,
	// `node file.ts` directly) rejects it outright rather than just ignoring the type annotation.
	// Spelled out so this class -- and everything that imports it -- stays runnable that way, which
	// this task's whole point (a genuinely Node-compatible daemon.ts) depends on.
	constructor(holderPid: number | null) {
		super(
			holderPid === null
				? "a daemon is already running and holds the single-instance lock"
				: `a daemon is already running (pid ${holderPid}) and holds the single-instance lock`,
		);
		this.name = "DaemonAlreadyRunningError";
		this.holderPid = holderPid;
	}
}

export interface MaintenanceTask {
	name: string;
	intervalMs: number;
	run: () => void | Promise<void>;
}

export interface RunningDaemon {
	host: string;
	port: number;
	/** Minted once at startup (see daemon-lifecycle.ts) -- present regardless of whether lifecycleLog was supplied, since it's cheap and useful identity even without logging. */
	instanceId: string;
	/** The idle-shutdown budget actually in effect (0 means disabled) -- exposed so a caller/test can observe the provenance-derived default without waiting it out. */
	idleBudgetMs: number;
	/** reason (e.g. "SIGTERM") is recorded to lifecycleLog when supplied; omitted defaults to "explicit". Purely additive over the prior zero-arg signature -- every existing caller keeps working unchanged. */
	stop(reason?: string): Promise<void>;
	/** Resolves once stop() has fully run, however it was triggered (an explicit call, or the internal idle timer) -- the single signal runDaemonProcess needs to exit the process for either case. */
	stopped: Promise<void>;
}

/**
 * Read by startDaemon() to pick a default idle-shutdown policy when the
 * caller doesn't set idleBudgetMs explicitly. Set by the two things that
 * actually start a daemon process: spawnDetachedDaemon() (pi-client.ts)
 * sets "auto-spawn" on a lazily-started child; the generated systemd
 * unit/launchd plist/Windows Run command (service.ts) sets "service". A
 * daemon started neither way (plain `bun cli.ts serve` during local
 * development) reports "unknown" and is treated the same as "auto-spawn" --
 * the safer default is to assume nothing should run forever unless a real
 * installed service said so.
 *
 * Both this file and pi-client.ts/service.ts declare this same string
 * independently rather than importing a shared constant -- pi-client.ts is
 * compiled standalone with no imports of its own by design (see its module
 * doc comment), so it cannot depend on this module.
 */
export const LAUNCH_PROVENANCE_ENV_VAR = "VEHICLE_LAUNCH_PROVENANCE";
export type LaunchProvenance = "auto-spawn" | "service" | "unknown";

export function readLaunchProvenance(env: Record<string, string | undefined> = process.env): LaunchProvenance {
	const value = env[LAUNCH_PROVENANCE_ENV_VAR];
	return value === "auto-spawn" || value === "service" ? value : "unknown";
}

/** Applied to an auto-spawned or provenance-unknown daemon when the caller doesn't set idleBudgetMs explicitly -- long enough to survive a normal idle gap between tool calls, short enough not to leak a process from one stray call for days. */
export const DEFAULT_AUTO_SPAWN_IDLE_BUDGET_MS = 30 * 60_000;

/** Pure resolution rule, exported for direct testing without waiting out a real idle window. Explicit always wins; "service" provenance means always-on (0/disabled); anything else gets the bounded auto-spawn default. */
export function resolveIdleBudgetMs(explicit: number | undefined, provenance: LaunchProvenance): number {
	if (explicit !== undefined) return explicit;
	return provenance === "service" ? 0 : DEFAULT_AUTO_SPAWN_IDLE_BUDGET_MS;
}

export interface StartDaemonOptions {
	/** e.g. "Web Spider" -- used only in the bind-failure error message. */
	daemonLabel: string;
	handlePath: string;
	/** Defaults to 0600 (owner-only), correct for a same-user daemon and consumer. Pass 0644 for a daemon meant to be discovered across OS users -- the handle's own content (host/port/pid) is never sensitive. See writeDaemonHandle. */
	handleMode?: number;
	/** Defaults to a `daemon.lock` file beside handlePath. Override only if that would collide with another daemon's own state. */
	lockPath?: string;
	buildApp: () => { fetch(request: Request): Promise<Response> };
	/** Defaults to a no-op logger; maintenance-task failures are otherwise silently lost, which was a real gap in two of the four original daemons. */
	logger?: Logger;
	maintenanceTasks?: MaintenanceTask[];
	/**
	 * Explicit override always wins. When omitted, the default is chosen from
	 * LAUNCH_PROVENANCE_ENV_VAR: "service" gets no idle shutdown (0, always-on);
	 * "auto-spawn" or "unknown" get DEFAULT_AUTO_SPAWN_IDLE_BUDGET_MS.
	 */
	idleBudgetMs?: number;
	idleTickMs?: number;
	onShutdown?: () => void | Promise<void>;
	/** Defaults to process.env. Injectable for tests. */
	env?: Record<string, string | undefined>;
	/**
	 * Stable cross-daemon identity name (Armada's own VehicleName pattern: ^[a-z0-9][a-z0-9._-]{0,63}$),
	 * e.g. "papyrus". When given, this daemon's handle is ALSO written into (and removed from) the
	 * shared Vehicle Handle Directory (see resolveSharedVehicleHandlePath) for cross-daemon
	 * discovery, alongside its own private handlePath -- unaffected either way. Omitted preserves
	 * today's behavior exactly: no shared-directory write at all. An invalid name or a write/remove
	 * failure is logged, never thrown -- must never be why a daemon fails to start or stop.
	 */
	vehicleName?: string;
	/** Absolute path to this daemon's own auth token FILE (never the token value) -- carried into
	 * the shared handle entry alongside vehicleName so a discovering broker with read access to it
	 * can authenticate. Ignored when vehicleName is omitted. Omitting this while vehicleName is set
	 * still writes a valid entry, just without tokenPath -- a broker can see the vehicle exists and
	 * is live, but not fetch its manifest. */
	tokenPath?: string;
	/** Optional WebSocket push-invalidation channel (see push-channel.ts). Additive to the fetch-based RPC -- requests to `pushPath` are routed to it, everything else still goes to buildApp()'s fetch. */
	pushChannel?: PushChannel;
	/** Defaults to "/push". */
	pushPath?: string;
	/**
	 * Overrides for the lock-reclaim behavior that only activates when this daemon's own
	 * launch provenance is "service" (see LAUNCH_PROVENANCE_ENV_VAR) and the current lock
	 * holder is not -- an ad hoc auto-spawned process (or a pre-migration lock file with no
	 * recorded provenance) has no standing to block a supervised restart. Real defaults
	 * (process.kill, a real setTimeout-backed sleep, a 5s grace period) apply when omitted;
	 * tests inject fakes to exercise the race without spawning real processes or waiting
	 * real wall-clock time. See paths.ts's acquireDaemonLockAsService.
	 */
	lockReclaim?: ReclaimDeps;
	/**
	 * Opt-in structured lifecycle event log (see daemon-lifecycle.ts) -- when supplied, startDaemon
	 * records "started"/"already_running"/"stopped" events against it. Omitted by default so every
	 * existing caller is unaffected; a consumer wanting a `<daemon> diagnose` command supplies one
	 * backed by openDaemonLifecycleLog(). Recording failures are logged and swallowed -- a lifecycle
	 * log must never be why a daemon fails to start or stop.
	 */
	lifecycleLog?: DaemonLifecycleLog;
}

const NOOP_LOGGER: Logger = { debug() {}, info() {}, warn() {}, error() {} };
const DEFAULT_IDLE_TICK_MS = 30_000;

/**
 * Wraps a caller-supplied lockReclaim (if any) so every reclaim decision is always logged
 * through this daemon's real logger, in addition to -- never instead of -- a test's own
 * injected log spy. A reap is warn-level (it changed what's running); a skip is info-level
 * (expected/no-op most of the time, but still worth a trace for "why didn't it take over").
 */
function reclaimDepsWithLogging(options: StartDaemonOptions, logger: Logger): ReclaimDeps {
	const injected = options.lockReclaim;
	return {
		...injected,
		log: (event) => {
			const level = event.outcome === "reaped" ? "warn" : "info";
			logger[level](`daemon lock ${event.outcome}`, {
				holderPid: event.holderPid,
				holderProvenance: event.holderProvenance,
				...(event.method ? { method: event.method } : {}),
				...(event.reason ? { reason: event.reason } : {}),
			});
			injected?.log?.(event);
		},
	};
}

export async function startDaemon(options: StartDaemonOptions): Promise<RunningDaemon> {
	const logger = options.logger ?? NOOP_LOGGER;
	const lockPath = options.lockPath ?? join(dirname(options.handlePath), "daemon.lock");
	const provenance = readLaunchProvenance(options.env ?? process.env);

	// Claimed before anything else -- a losing process must not build the app,
	// bind a port, or touch the handle file. See DaemonAlreadyRunningError.
	//
	// A "service"-launched daemon (Armada/systemd-supervised) additionally reclaims the lock
	// from an unmanaged holder instead of just losing to it -- see acquireDaemonLockAsService.
	// Any other provenance (auto-spawn/unknown) keeps today's plain behavior unchanged: losing
	// the race there is a normal join between equally-unprivileged callers, not something to
	// escalate over.
	const instanceId = randomUUID();
	// Awaited (not fire-and-forget) at every call site -- a few ms of extra latency on
	// start/stop is an acceptable, bounded cost for a deterministic, testable log; the
	// try/catch is what actually keeps "never be why a daemon fails to start/stop" true,
	// not fire-and-forget's silent race against whatever reads the log next.
	const recordLifecycle = async (type: "started" | "already_running" | "stopped", reason?: string): Promise<void> => {
		if (!options.lifecycleLog) return;
		try {
			await options.lifecycleLog.record({ instanceId, pid: process.pid, type, provenance, reason });
		} catch (error) {
			logger.error("daemon lifecycle log record failed", { error: error instanceof Error ? error.message : String(error) });
		}
	};

	const lock =
		provenance === "service"
			? await acquireDaemonLockAsService(lockPath, reclaimDepsWithLogging(options, logger))
			: acquireDaemonLock(lockPath, undefined, provenance);
	if (!lock.acquired) {
		await recordLifecycle("already_running", lock.holderPid === null ? undefined : `holder pid ${lock.holderPid}`);
		throw new DaemonAlreadyRunningError(lock.holderPid);
	}

	if (options.pushChannel && !isBun) {
		releaseDaemonLock(lockPath); // never held the port -- must not leave the lock as if it had
		throw new Error(
			`${options.daemonLabel}: pushChannel requires the Bun runtime (WebSocket upgrade support) -- omit pushChannel to run this daemon under Node, or run it under Bun.`,
		);
	}

	const app = options.buildApp();
	const pushPath = options.pushPath ?? "/push";

	let lastActive = Date.now();
	const onRequest = (): void => {
		lastActive = Date.now();
	};
	const listener = isBun ? await startBunListener(options, app, pushPath, onRequest) : await startNodeListener(app, onRequest);
	if (!listener.port) {
		throw new Error(`${options.daemonLabel} daemon failed to bind a listener`);
	}
	writeDaemonHandle(options.handlePath, { host: LOOPBACK_HOST, port: listener.port, pid: process.pid }, options.handleMode);
	if (options.vehicleName) {
		try {
			writeDaemonHandle(resolveSharedVehicleHandlePath(options.vehicleName, { env: options.env }), {
				host: LOOPBACK_HOST,
				port: listener.port,
				pid: process.pid,
				...(options.tokenPath ? { tokenPath: options.tokenPath } : {}),
			});
		} catch (error) {
			logger.error("shared vehicle handle write failed", { error: error instanceof Error ? error.message : String(error) });
		}
	}
	await recordLifecycle("started");

	const timers: ReturnType<typeof setInterval>[] = [];
	for (const task of options.maintenanceTasks ?? []) {
		// `task.run` may return a Promise; awaiting inside this IIFE (rather than the historical
		// `try { void task.run() } catch`) is load-bearing. A synchronous throw is caught either
		// way, but a *rejected* Promise from an async run() would otherwise become an unhandled
		// rejection outside this try/catch entirely -- Bun does not swallow that, it crashes the
		// process (verified directly against a consuming daemon's own now-redundant guard against
		// exactly this: jittor's reportMaintenanceFailure existed only because `void somePromise()`
		// with no `.catch` was fatal). A consumer daemon must get that protection for free.
		const runTask = () => {
			void (async () => {
				try {
					await task.run();
				} catch (error) {
					logger.error(`maintenance task failed: ${task.name}`, { error: error instanceof Error ? error.message : String(error) });
				}
			})();
		};
		// Real gap this closes: a bare setInterval never fires until its full interval first
		// elapses -- for a long-interval task (e.g. pi-packed's own 30-minute vehicle-reconcile,
		// which exists specifically to self-heal drift a running daemon never picked up) that
		// means a daemon which just started -- exactly when accumulated drift is most likely --
		// silently waits up to the full interval before its first check. Running once immediately
		// here, in addition to the interval below, matches what a maintenance task's own callers
		// already assume (pi-packed's CLI help text already claims "the daemon also runs this on
		// its own interval and at startup" -- this makes that claim true).
		runTask();
		timers.push(setInterval(runTask, task.intervalMs));
	}

	const effectiveIdleBudgetMs = resolveIdleBudgetMs(options.idleBudgetMs, provenance);

	let idleTimer: ReturnType<typeof setInterval> | undefined;
	if (effectiveIdleBudgetMs > 0) {
		const budget = effectiveIdleBudgetMs;
		idleTimer = setInterval(() => {
			if (Date.now() - lastActive > budget) {
				logger.info("idle budget exceeded, shutting down", { idleBudgetMs: budget });
				void stop("idle_budget_exceeded");
			}
		}, options.idleTickMs ?? DEFAULT_IDLE_TICK_MS);
	}

	let alreadyStopping = false;
	let resolveStopped: () => void = () => {};
	const stoppedPromise = new Promise<void>((resolve) => {
		resolveStopped = resolve;
	});
	const stop = async (reason = "explicit"): Promise<void> => {
		if (alreadyStopping) return;
		alreadyStopping = true;
		await recordLifecycle("stopped", reason);
		for (const timer of timers) clearInterval(timer);
		if (idleTimer) clearInterval(idleTimer);
		removeDaemonHandle(options.handlePath);
		if (options.vehicleName) {
			try {
				removeDaemonHandle(resolveSharedVehicleHandlePath(options.vehicleName, { env: options.env }));
			} catch (error) {
				logger.error("shared vehicle handle remove failed", { error: error instanceof Error ? error.message : String(error) });
			}
		}
		releaseDaemonLock(lockPath);
		await options.onShutdown?.();
		await listener.stop();
		resolveStopped();
	};

	return { host: LOOPBACK_HOST, port: listener.port, instanceId, idleBudgetMs: effectiveIdleBudgetMs, stop, stopped: stoppedPromise };
}

export interface RunDaemonProcessOptions extends StartDaemonOptions {
	/**
	 * instanceId is additive over the original {host, port}-only shape -- an existing caller
	 * destructuring just those two fields is unaffected. Included because buildApp() (where a
	 * composition root would register a `<daemon> diagnose` Vehicle operation) runs *inside*
	 * startDaemon(), before RunningDaemon -- and its own instanceId -- is ever returned to the
	 * caller; onListen is the first caller-visible hook that fires after identity is known, so it's
	 * where a composition root captures it (typically into a mutable ref) for such a handler to read
	 * lazily at call time.
	 */
	onListen?: (info: { host: string; port: number; instanceId: string }) => void;
}

/**
 * The real binary's entry point: starts the daemon, wires SIGINT/SIGTERM to
 * a clean stop + exit. A DaemonAlreadyRunningError (another live process
 * already holds the single-instance lock) is a normal join, not a crash --
 * this process exits 0 without ever having bound a port.
 */
export function runDaemonProcess(options: RunDaemonProcessOptions): void {
	const logger = options.logger ?? NOOP_LOGGER;
	void runDaemonProcessAsync(options, logger);
}

async function runDaemonProcessAsync(options: RunDaemonProcessOptions, logger: Logger): Promise<void> {
	let daemon: RunningDaemon;
	try {
		daemon = await startDaemon(options);
	} catch (error) {
		if (error instanceof DaemonAlreadyRunningError) {
			logger.info(error.message);
			process.exit(0);
		}
		// Rethrown deliberately, not swallowed -- an unhandled rejection crashes
		// the process by default under both Bun and Node, the same loud failure
		// a synchronous throw from the pre-async version of this function gave.
		throw error;
	}
	options.onListen?.({ host: daemon.host, port: daemon.port, instanceId: daemon.instanceId });
	// One unified exit path for both triggers: an explicit SIGINT/SIGTERM below, or the
	// idle timer inside startDaemon() calling stop() on its own. Either way, once stop()
	// has actually finished, this process must exit -- Restart=always (or any other
	// process manager) only recovers a daemon that genuinely exits.
	void daemon.stopped.then(() => process.exit(0));
	let shuttingDown = false;
	const shutdown = (signal: string): void => {
		if (shuttingDown) return;
		shuttingDown = true;
		void daemon.stop(signal);
	};
	process.on("SIGINT", () => shutdown("SIGINT"));
	process.on("SIGTERM", () => shutdown("SIGTERM"));
}
