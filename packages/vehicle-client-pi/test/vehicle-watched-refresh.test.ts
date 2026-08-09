import { afterEach, describe, expect, it } from "bun:test";
import { RemoteVehicleClient } from "@danypops/vehicle-client/http";
import { vehicleWatchTopic, WatchRegistry } from "@danypops/vehicle-core";
import { VehicleRegistry } from "@danypops/vehicle-server";
import { createVehicleHttpApp } from "@danypops/vehicle-server/http";
import { PushChannel } from "@danypops/vehicle-server/push-channel";
import { createVehicleWatchOperations } from "@danypops/vehicle-server/watchers";
import { startWatchedRefresh, type VehicleWatchTarget } from "../src/vehicle-watched-refresh.ts";

const LIMITS = { defaultTimeoutMs: 1_000, maxTimeoutMs: 5_000, maxRequestBytes: 1_024, maxResponseBytes: 1_024 } as const;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("startWatchedRefresh: Pi-side generic watch/unwatch + push/poll refresh helper", () => {
	// Never attempts a push connection when resolvePushTarget returns undefined.
	it("calls refresh immediately and on each poll tick", async () => {
		let refreshCount = 0;
		let watchCalls = 0;
		const handle = startWatchedRefresh({
			watch: async () => {
				watchCalls++;
				return undefined; // daemon unreachable -- the realistic "poll only" case
			},
			resolvePushTarget: () => undefined,
			refresh: () => {
				refreshCount++;
			},
			pollIntervalMs: 15,
		});

		await sleep(50);
		handle.stop();

		expect(refreshCount).toBeGreaterThanOrEqual(2); // the immediate call plus at least one tick
		expect(watchCalls).toBeGreaterThanOrEqual(1); // retried watch() despite it returning undefined every time
	});

	it("stop() is idempotent and stops further refresh/watch activity", async () => {
		let refreshCount = 0;
		const handle = startWatchedRefresh({
			watch: async () => undefined,
			resolvePushTarget: () => undefined,
			refresh: () => {
				refreshCount++;
			},
			pollIntervalMs: 10,
		});
		await sleep(15);
		handle.stop();
		const countAtStop = refreshCount;
		handle.stop(); // idempotent -- must not throw or double-clear
		await sleep(30);
		expect(refreshCount).toBe(countAtStop);
	});

	describe("against a real HTTP + push-channel Vehicle server", () => {
		let server: ReturnType<typeof Bun.serve> | undefined;

		afterEach(() => {
			server?.stop(true);
			server = undefined;
		});

		function startServer(): { baseUrl: string; pushUrl: string; token: string; pushChannel: PushChannel } {
			const token = "test-token";
			const watchRegistry = new WatchRegistry();
			const registry = new VehicleRegistry({ name: "test", version: "1", description: "Test." });
			const { watch, unwatch } = createVehicleWatchOperations({ name: "resource", registry: watchRegistry, limits: LIMITS });
			registry.register("test-owner", watch);
			registry.register("test-owner", unwatch);

			const pushChannel = new PushChannel({ token });
			const app = createVehicleHttpApp({ registry, token });
			server = Bun.serve({
				hostname: "127.0.0.1",
				port: 0,
				fetch: (request, bunServer) => {
					if (new URL(request.url).pathname === "/push") return pushChannel.upgrade(request, bunServer) ?? undefined;
					return app.fetch(request);
				},
				websocket: pushChannel.websocketHandlers(),
			});
			const port = server.port;
			return { baseUrl: `http://127.0.0.1:${port}`, pushUrl: `ws://127.0.0.1:${port}/push`, token, pushChannel };
		}

		// Published by the provider directly to the returned topic.
		it("a resource change drives a push-triggered refresh", async () => {
			const { baseUrl, pushUrl, token, pushChannel } = startServer();
			const client = new RemoteVehicleClient({ baseUrl, token });

			let refreshCount = 0;
			let lastTarget: VehicleWatchTarget | undefined;
			const handle = startWatchedRefresh({
				watch: async () => {
					const target = await client.invoke<VehicleWatchTarget>("resource.watch", 1, { resource: "task-1" });
					lastTarget = target;
					return target;
				},
				resolvePushTarget: () => ({ url: pushUrl, token }),
				refresh: () => {
					refreshCount++;
				},
				pollIntervalMs: 5_000, // long enough that any refresh beyond the immediate one is push-driven, not poll-driven
			});

			// Let watch() resolve and the push connection open + subscribe.
			for (let i = 0; i < 50 && !lastTarget; i++) await sleep(10);
			expect(lastTarget).toBeDefined();
			await sleep(30);

			const beforePush = refreshCount;
			pushChannel.publish(vehicleWatchTopic(lastTarget!.watchId), { changed: true });
			await sleep(30);

			expect(refreshCount).toBeGreaterThan(beforePush);
			handle.stop();
		});

		// Even though a watch is otherwise reachable.
		it("polling alone still refreshes when the push target never resolves", async () => {
			const { baseUrl, token } = startServer();
			const client = new RemoteVehicleClient({ baseUrl, token });

			let refreshCount = 0;
			const handle = startWatchedRefresh({
				watch: async () => client.invoke<VehicleWatchTarget>("resource.watch", 1, { resource: "task-1" }),
				resolvePushTarget: () => undefined, // e.g. the push channel URL genuinely isn't resolvable in this environment
				refresh: () => {
					refreshCount++;
				},
				pollIntervalMs: 15,
			});

			await sleep(60);
			handle.stop();

			expect(refreshCount).toBeGreaterThanOrEqual(3);
		});

		// A daemon restart rebinds a new random port -- the push socket may never visibly "close"
		// if the new process happens to accept the reconnect, so renewal must be driven by the
		// push target's own url changing, not socket state alone.
		it("renews the watch when the push target's own url changes, even without the socket ever closing", async () => {
			const first = startServer();
			const second = startServer();
			let pushUrl = first.pushUrl;
			const firstClient = new RemoteVehicleClient({ baseUrl: first.baseUrl, token: first.token });
			const secondClient = new RemoteVehicleClient({ baseUrl: second.baseUrl, token: second.token });

			const watchTargets: VehicleWatchTarget[] = [];
			const unwatched: string[] = [];
			const states: string[] = [];
			const handle = startWatchedRefresh({
				watch: async () => {
					const client = pushUrl === first.pushUrl ? firstClient : secondClient;
					const target = await client.invoke<VehicleWatchTarget>("resource.watch", 1, { resource: "task-1" });
					watchTargets.push(target);
					return target;
				},
				unwatch: async (target) => {
					unwatched.push(target.watchId);
				},
				resolvePushTarget: () => ({ url: pushUrl, token: pushUrl === first.pushUrl ? first.token : second.token }),
				refresh: () => {},
				pollIntervalMs: 15,
				onStateChange: (state) => states.push(state),
			});

			for (let i = 0; i < 50 && watchTargets.length < 1; i++) await sleep(10);
			expect(watchTargets).toHaveLength(1);
			const firstWatchId = watchTargets[0]!.watchId;

			// Simulate the daemon restarting on a new port: the resolver now reports the new url.
			pushUrl = second.pushUrl;
			for (let i = 0; i < 50 && watchTargets.length < 2; i++) await sleep(10);

			expect(watchTargets).toHaveLength(2);
			expect(watchTargets[1]!.watchId).not.toBe(firstWatchId);
			expect(unwatched).toContain(firstWatchId);
			expect(states).toContain("renewing");
			expect(states).toContain("connected");

			handle.stop();
		});

		it("reportUnknownWatch() forces an immediate renewal without waiting for the next poll tick", async () => {
			const { baseUrl, pushUrl, token } = startServer();
			const client = new RemoteVehicleClient({ baseUrl, token });

			const watchTargets: VehicleWatchTarget[] = [];
			const handle = startWatchedRefresh({
				watch: async () => {
					const target = await client.invoke<VehicleWatchTarget>("resource.watch", 1, { resource: "task-1" });
					watchTargets.push(target);
					return target;
				},
				resolvePushTarget: () => ({ url: pushUrl, token }),
				refresh: () => {},
				pollIntervalMs: 5_000, // long enough that a second watch() within the test window must be reportUnknownWatch-driven
			});

			for (let i = 0; i < 50 && watchTargets.length < 1; i++) await sleep(10);
			expect(watchTargets).toHaveLength(1);

			handle.reportUnknownWatch();
			for (let i = 0; i < 50 && watchTargets.length < 2; i++) await sleep(10);
			expect(watchTargets).toHaveLength(2);
			expect(watchTargets[1]!.watchId).not.toBe(watchTargets[0]!.watchId);

			handle.stop();
		});
	});

	describe("bounded, single-flighted renewal and explicit terminal states", () => {
		it("never runs two replacement watch() calls concurrently, even under overlapping renewal signals", async () => {
			let inFlight = 0;
			let maxConcurrent = 0;
			let watchCalls = 0;
			const handle = startWatchedRefresh({
				watch: async () => {
					inFlight++;
					maxConcurrent = Math.max(maxConcurrent, inFlight);
					watchCalls++;
					await sleep(20);
					inFlight--;
					return { watchId: `w${watchCalls}`, topic: `t${watchCalls}` };
				},
				resolvePushTarget: () => undefined,
				refresh: () => {},
				pollIntervalMs: 5,
			});

			// Fire several overlapping signals while the first watch() call is still in flight.
			handle.reportUnknownWatch();
			handle.reportUnknownWatch();
			handle.reportUnknownWatch();
			await sleep(60);
			handle.stop();

			expect(maxConcurrent).toBe(1);
		});

		it("reports resolver-failed on a single failed attempt, then timed-out once maxRenewAttempts is exhausted", async () => {
			const states: string[] = [];
			const handle = startWatchedRefresh({
				watch: async () => {
					throw new Error("daemon unreachable");
				},
				resolvePushTarget: () => undefined,
				refresh: () => {},
				pollIntervalMs: 10,
				maxRenewAttempts: 2,
				onStateChange: (state) => states.push(state),
			});

			for (let i = 0; i < 50 && !states.includes("timed-out"); i++) await sleep(10);
			handle.stop();

			expect(states).toContain("resolver-failed");
			expect(states).toContain("timed-out");
		});

		it("stops attempting watch() again once timed-out, but keeps polling regardless", async () => {
			let watchCalls = 0;
			let refreshCount = 0;
			const states: string[] = [];
			const handle = startWatchedRefresh({
				watch: async () => {
					watchCalls++;
					throw new Error("daemon unreachable");
				},
				resolvePushTarget: () => undefined,
				refresh: () => {
					refreshCount++;
				},
				pollIntervalMs: 5,
				maxRenewAttempts: 2,
				onStateChange: (state) => states.push(state),
			});

			for (let i = 0; i < 50 && !states.includes("timed-out"); i++) await sleep(5);
			expect(states).toContain("timed-out");
			const callsAtTimeout = watchCalls;
			const refreshAtTimeout = refreshCount;

			await sleep(40);
			handle.stop();

			expect(watchCalls).toBe(callsAtTimeout); // no further watch() attempts once timed-out
			expect(refreshCount).toBeGreaterThan(refreshAtTimeout); // polling never stopped
		});

		it("reports canceled exactly once when stop() is called, even if called twice", () => {
			const states: string[] = [];
			const handle = startWatchedRefresh({
				watch: async () => undefined,
				resolvePushTarget: () => undefined,
				refresh: () => {},
				pollIntervalMs: 1_000,
				onStateChange: (state) => states.push(state),
			});
			handle.stop();
			handle.stop();
			expect(states.filter((state) => state === "canceled")).toHaveLength(1);
		});

		it("releases the current watch best-effort when stop() is called", async () => {
			const unwatched: string[] = [];
			const handle = startWatchedRefresh({
				watch: async () => ({ watchId: "w1", topic: "t1" }),
				unwatch: async (target) => {
					unwatched.push(target.watchId);
				},
				resolvePushTarget: () => undefined,
				refresh: () => {},
				pollIntervalMs: 1_000,
			});
			await sleep(15);
			handle.stop();
			await sleep(5);
			expect(unwatched).toEqual(["w1"]);
		});
	});
});
