/**
 * Bun.serve-backed HTTP listener adapter. Split out of daemon.ts's own bundled concerns (Vehicle
 * Pass 1 SRP audit finding #7). Takes only the narrow slice of StartDaemonOptions it actually
 * reads (pushChannel), rather than the whole options bag, so this file has no dependency on
 * daemon.ts itself.
 */

import { randomUUID } from "node:crypto";
import { LOOPBACK_HOST } from "../paths.ts";
import type { PushChannel } from "../push-channel.ts";
import { runWithRpcCallId } from "../rpc-correlation.ts";
import type { DaemonApp, ListeningServer } from "./listener.ts";

// Bun.serve's own idleTimeout defaults to 10s and applies per-connection regardless of how long a
// given request is expected to take -- confirmed live against a real running daemon: a genuine
// cross-process Node client hitting a real Vehicle SSE invoke() response (vehicle-http-provider.ts's
// wantsStream) that goes quiet between progress ticks got its socket actively closed by Bun at ~12s,
// surfacing as Node's "fetch failed" / SocketError "other side closed" (UND_ERR_SOCKET) -- independent
// of and before any operation-level VehicleLimits.maxTimeoutMs deadline ever got a chance to apply.
// Bounded (not server.timeout(request, 0)'s literal no-timeout) to the same order of magnitude as this
// ecosystem's longest-lived longRunning operations today.
//
// A SECOND, later-confirmed live incident (papyrus task d0eb81b7, vehicle task 59a22737) hit the
// exact same failure for a PLAIN (non-SSE) POST /vehicle/invoke: a caller-configured
// background-free operation that itself takes many seconds to tens of seconds (e.g. Papyrus's
// tasks.run_gates/tasks.complete actually shelling out to and waiting on a caller's own gate
// command) sends zero response bytes the whole time it runs -- just as exposed to Bun's 10s idle
// default as the streaming case, and this route was explicitly NOT covered by the
// Accept:text/event-stream check alone. VehicleLimits.maxTimeoutMs/an operation's own configured
// timeout are moot if the raw TCP connection is already dead before either ever gets a chance to
// apply. Every /vehicle/invoke POST now gets this same generous ceiling regardless of Accept --
// real per-operation timeout enforcement already happens at the application layer (VehicleLimits,
// AbortController, a gate's own timeoutMs); Bun's own raw idle timeout has no business being the
// one that fires first. Every OTHER route (manifest, cancel, the Vehicle Jobs submit/poll/tail/
// steer/cancel routes, all of which are documented as never blocking) keeps Bun's normal 10s.
const STREAMING_IDLE_TIMEOUT_S = 3_600;
const VEHICLE_INVOKE_PATH = "/vehicle/invoke";

export interface BunListenerOptions {
	/** Optional WebSocket push-invalidation channel (see push-channel.ts) -- see StartDaemonOptions.pushChannel. */
	pushChannel?: PushChannel;
}

export function startBunListener(
	options: BunListenerOptions,
	app: DaemonApp,
	pushPath: string,
	onRequest: () => void,
): Promise<ListeningServer> {
	const server = Bun.serve({
		hostname: LOOPBACK_HOST,
		port: 0,
		fetch: (request, bunServer) => {
			onRequest();
			const pathname = new URL(request.url).pathname;
			if (options.pushChannel && pathname === pushPath) {
				return options.pushChannel.upgrade(request, bunServer) ?? undefined;
			}
			if (pathname === VEHICLE_INVOKE_PATH || (request.headers.get("accept") ?? "").includes("text/event-stream")) {
				bunServer.timeout(request, STREAMING_IDLE_TIMEOUT_S);
			}
			return runWithRpcCallId(randomUUID(), () => app.fetch(request));
		},
		// Bun's own types require `websocket` whenever `fetch`'s server parameter
		// carries per-connection data (SubscriberData here) -- a no-op fallback
		// when there is no pushChannel is safe: server.upgrade() is never called
		// in that case, so these handlers are never invoked.
		websocket: options.pushChannel?.websocketHandlers() ?? { message() {} },
	});
	return Promise.resolve({
		port: server.port ?? 0,
		stop: () => server.stop(true),
	});
}
