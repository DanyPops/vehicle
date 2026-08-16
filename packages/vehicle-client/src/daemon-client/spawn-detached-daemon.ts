/**
 * Platform-correct options for auto-spawning a detached daemon process. Split out of
 * daemon-client.ts's own bundled concerns -- still zero runtime imports of its own (see
 * daemon-client.ts's own module doc comment for why that invariant matters for Pi's
 * jiti-based extension loader).
 */

export interface SpawnDetachedDaemonOptions {
	/** Path to the daemon's entry point, e.g. a `#!/usr/bin/env bun` cli.ts. */
	binPath: string;
	args?: string[];
	env?: Record<string, string | undefined>;
	/** Defaults to process.platform. Exposed for tests -- never meant to be overridden in production. */
	platform?: NodeJS.Platform;
	/**
	 * The actual spawn function, injected so this module never hard-imports
	 * node:child_process (this file has no imports of its own -- see the
	 * module doc comment -- keeping it that way matters for Pi's jiti loader).
	 * Each consumer already has a working spawn call; this only supplies the
	 * platform-correct *options* for it.
	 */
	spawn: (command: string, args: string[], options: SpawnPlatformOptions) => void;
}

export interface SpawnPlatformOptions {
	detached: boolean;
	stdio: "ignore";
	env?: Record<string, string | undefined>;
	/** Only meaningful (and only set) on win32 -- suppresses the console window a detached spawn would otherwise pop open. */
	windowsHide?: boolean;
}

/**
 * Centralizes the platform-correct options for auto-spawning a detached
 * daemon process, so each of connectWithPolicy's four independent `spawn()`
 * callbacks doesn't have to get this right on its own. Two Windows-specific
 * gaps this closes:
 *
 * - `windowsHide: true` is required on win32 or a silent background
 *   auto-spawn pops a visible console window.
 * - SIGTERM is not a real signal on Windows: `child.kill("SIGTERM")` there
 *   terminates the process immediately rather than invoking a graceful
 *   shutdown handler, so a killed daemon's own cleanup (handle/lock removal)
 *   never runs. This function does not attempt to work around that --
 *   there is nothing a spawn-time option can do about a signal Windows
 *   doesn't implement. The single-instance lock's stale-pid recovery (see
 *   startDaemon) is the actual recovery path there, not graceful shutdown;
 *   this is stated here so no caller adds a Windows SIGTERM handler
 *   expecting it to reliably fire.
 *
 * The caller still owns `.unref()` on whatever handle its injected `spawn`
 * returns -- this function only shapes the options object, since detaching
 * the returned child handle is inherently spawn-implementation-specific
 * (node:child_process vs Bun.spawn expose that differently).
 */
export function spawnDetachedDaemon(options: SpawnDetachedDaemonOptions): void {
	const platform = options.platform ?? process.platform;
	const spawnOptions: SpawnPlatformOptions = {
		detached: true,
		stdio: "ignore",
		// "VEHICLE_LAUNCH_PROVENANCE": lets startDaemon() (daemon.ts) pick a
		// bounded default idle-shutdown budget for a lazily auto-spawned daemon
		// instead of running forever by default -- a caller-supplied value in
		// options.env always wins over this default. Declared as the same literal
		// string independently in daemon.ts/service.ts rather than imported, since
		// this module has no imports of its own by design (see the module doc
		// comment).
		env: { VEHICLE_LAUNCH_PROVENANCE: "auto-spawn", ...options.env },
		...(platform === "win32" ? { windowsHide: true } : {}),
	};
	options.spawn(options.binPath, options.args ?? [], spawnOptions);
}
