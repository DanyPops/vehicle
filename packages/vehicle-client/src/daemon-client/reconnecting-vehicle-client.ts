/**
 * createReconnectingVehicleClient -- a VehicleClient that survives a daemon restart without a
 * full Pi extension reload. Split out of daemon-client.ts's own bundled concerns -- the one file
 * in this split with a real (type-only, fully-erased) external import; see daemon-client.ts's
 * own module doc comment for why the "no runtime imports" invariant matters for Pi's jiti-based
 * extension loader, and why a type-only import doesn't violate it.
 */

import type { VehicleClient } from "@danypops/vehicle-core";
import { type CreateRetryingClientOptions, createRetryingClient } from "./retrying-client.js";

/**
 * A VehicleClient (@danypops/vehicle-core) that survives a daemon restart
 * without a full Pi extension reload. Confirmed live gap: registerVehicleTools()
 * (@danypops/vehicle-client-pi) captures one concrete VehicleClient forever in
 * every registered tool's closure -- when the daemon rebinds a new random
 * port (any restart), every tool call fails with a bare connection error
 * until the whole extension reloads and re-registers with a fresh client.
 * Passing `createReconnectingVehicleClient(connect)` instead of a bare
 * `new RemoteVehicleClient(...)` to registerVehicleTools() fixes this at the
 * one shared layer every Vehicle consumer already goes through, instead of
 * each hand-rolling its own reconnect wrapper.
 *
 * `connect` is re-invoked with the CALLER's own current target resolution
 * (e.g. re-reading a handle file for the daemon's latest port/token) --
 * this only works if `connect` itself re-resolves that target on each call,
 * not if it closes over one target captured at Pi session_start.
 *
 * manifest() is always safe to retry transparently (read-only, idempotent) --
 * uses call(), so a stale connection self-heals on the very next manifest
 * refresh (e.g. refreshVehicleToolAvailability()'s own periodic cadence)
 * with no visible failure to any caller.
 *
 * invoke() is deliberately NOT auto-retried: Vehicle's own idempotency model
 * (safe/keyed/unsafe) is real per-operation information this generic
 * wire-level wrapper has no way to safely generalize over (a keyed
 * operation's actual dedup, if any, lives in that operation's own handler,
 * not centrally in VehicleRegistry). Uses callOnce(), so a failed invoke()
 * still surfaces its real error to the caller exactly once -- never silently
 * double-invoked -- but the stale connection is dropped either way, so the
 * *next* invoke() (a model's natural retry after a tool error, or any other
 * call) reconnects and succeeds instead of failing forever.
 */
export function createReconnectingVehicleClient(
	connect: () => Promise<VehicleClient>,
	options: CreateRetryingClientOptions = {},
): VehicleClient {
	const retrying = createRetryingClient<VehicleClient>(connect, { label: "Vehicle", ...options });
	let closed = false;

	function assertNotClosed(): void {
		if (closed) throw new Error("Vehicle client closed");
	}

	return {
		async manifest() {
			assertNotClosed();
			return retrying.call((client) => client.manifest());
		},
		async invoke(name, version, input, invocationOptions) {
			assertNotClosed();
			return retrying.callOnce((client) => client.invoke(name, version, input, invocationOptions), {
				operationId: invocationOptions?.operationId,
			});
		},
		async close() {
			if (closed) return;
			closed = true;
			retrying.reset();
		},
	};
}
