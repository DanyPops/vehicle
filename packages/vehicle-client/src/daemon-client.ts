/**
 * Generalizes the retry-once-on-stale-connection wrapper independently
 * reimplemented in lector's `lectorClient()`, web-spider's `callWebSpider()`,
 * papyrus's `callService()`, and pi-packed's `createNatives()` -- one Pi
 * extension-facing seam every consumer daemon needed and none of them
 * shared. A daemon binds a new random port on every restart; a client
 * resolved once and cached for a whole Pi session would otherwise keep
 * calling a dead port until the extension reloaded. `createRetryingClient`
 * detects that on the failing call itself, drops the cached client, and
 * retries exactly once against a freshly reconnected one.
 *
 * Shipped pre-compiled (see the package's `build:daemon-client` script and
 * its `./daemon-client` export) rather than raw TypeScript like the rest of
 * this package -- this is the one module here meant to be imported directly
 * by a Pi extension rather than by another Bun daemon, and Pi's jiti-based
 * extension loader has a real, demonstrated failure class importing a
 * dependency's raw, unbuilt TypeScript (see @danypops/vehicle-client-pi's
 * pi-load-harness.ts). This module (and its own daemon-client/* siblings)
 * has no RUNTIME imports outside itself -- fetch/Request/TypeError/AbortError
 * are all global -- so it is safe to load under Node without a Bun runtime,
 * and has no Pi-API dependency of its own despite existing mainly for Pi
 * extensions to reach a Vehicle server. Splitting the source into the
 * daemon-client/ subdirectory below does not violate that: tsc compiles the
 * whole closure together into dist/daemon-client.js + dist/daemon-client/*.js,
 * so the SHIPPED artifact is still a self-contained, plain-Node-safe tree of
 * relative imports -- the invariant is about the compiled import graph never
 * reaching outside this package, not about the source file count.
 * reconnecting-vehicle-client.ts carries the one type-only import (VehicleClient's
 * shape, for createReconnectingVehicleClient), fully erased at compile time and
 * carrying no runtime module resolution of its own.
 *
 * `connectWithPolicy` covers the other silent per-daemon fork found
 * alongside the retry duplication: whether a missing daemon should be
 * auto-started or fail closed. Both are legitimate policies (web-spider
 * auto-spawns; lector/papyrus/pi-packed fail closed) but were each
 * hardcoded per daemon instead of being a parameter of one shared helper.
 */

export { type ConnectPolicyOptions, connectWithPolicy, type DaemonHandleLike } from "./daemon-client/connect-with-policy.js";
export {
	type ConnectVersionCheckRetryOptions,
	compareVersions,
	connectWithVersionCheck,
	type ExpectedVersion,
	type VersionCheckOptions,
} from "./daemon-client/connect-with-version-check.js";
export { type DaemonStatus, type DaemonStatusOptions, type DaemonStatusState, daemonStatus } from "./daemon-client/daemon-status.js";
export {
	type CallOnceOptions,
	type DaemonIdentityChange,
	type DaemonInstanceIdentity,
	daemonInstanceIdentity,
	isDefinitelyPreDispatchConnectionError,
	isLikelyStaleConnectionError,
	MutationOutcomeUnknownError,
	PreDispatchConnectionError,
	type StaleConnectionPredicate,
} from "./daemon-client/errors.js";
export {
	connectPushChannel,
	type PushChannelClient,
	type PushChannelClientOptions,
	type PushChannelState,
} from "./daemon-client/push-channel-client.js";
export { createReconnectingVehicleClient } from "./daemon-client/reconnecting-vehicle-client.js";
export {
	type CircuitBreakerOptions,
	type CircuitBreakerState,
	type ConnectRetryOptions,
	type CreateRetryingClientOptions,
	createRetryingClient,
	DEFAULT_CONNECT_RETRY,
	type RetryingClient,
	type RetryingClientDiagnosticEvent,
} from "./daemon-client/retrying-client.js";
export {
	type SpawnDetachedDaemonOptions,
	type SpawnPlatformOptions,
	spawnDetachedDaemon,
} from "./daemon-client/spawn-detached-daemon.js";
