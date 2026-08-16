/**
 * Vehicle Jobs' client-side conformance suite: LocalVehicleClient and RemoteVehicleClient exposing
 * the same submitJob/pollJob/tailJob/steerJob/cancelJob surface, with real parity between the two --
 * mirrors vehicle-http.test.ts's own "local/HTTP parity" framing, but for jobs instead of invoke().
 * The HTTP half exercises a real network round trip (createVehicleHttpApp + RemoteVehicleClient),
 * not an in-process registry call, per this house's own lesson from the callerSessionId wire-drop
 * bug: a wire-crossing feature is only proven by a test that actually crosses the wire.
 */
import { afterEach, describe, expect, it } from "bun:test";
import {
	bindVehicleOperation,
	defineVehicleOperation,
	defineVehicleSchema,
	isVehicleError,
	type JsonValue,
	type VehicleClient,
} from "@danypops/vehicle-core";
import { VehicleRegistry } from "@danypops/vehicle-server";
import { createVehicleHttpApp } from "@danypops/vehicle-server/http";
import { VehicleJobStore } from "@danypops/vehicle-server/jobs";
import { RemoteVehicleClient } from "../src/vehicle-http-client.ts";
import { LocalVehicleClient } from "../src/vehicle-local-client.ts";

const objectSchema = <T extends Record<string, unknown>>(properties: Record<string, JsonValue>, parse: (value: unknown) => T | undefined) =>
	defineVehicleSchema<T>({
		jsonSchema: { type: "object", properties, additionalProperties: false },
		safeParse(value) {
			const parsed = parse(value);
			return parsed ? { success: true, value: parsed } : { success: false, issues: [{ path: [], message: "invalid object" }] };
		},
	});

const inputSchema = objectSchema<{ runId: string }>({ runId: { type: "string" } }, (value) =>
	typeof value === "object" && value !== null && typeof (value as { runId?: unknown }).runId === "string"
		? { runId: (value as { runId: string }).runId }
		: undefined,
);
const outputSchema = objectSchema<{ status: string }>({ status: { type: "string" } }, (value) =>
	typeof value === "object" && value !== null && typeof (value as { status?: unknown }).status === "string"
		? { status: (value as { status: string }).status }
		: undefined,
);

const LIMITS = { defaultTimeoutMs: 1_000, maxTimeoutMs: 5_000, maxRequestBytes: 4_096, maxResponseBytes: 4_096 } as const;
const WAKE_BUDGET = { maxCount: 50, maxBytes: 50_000 };

/** A handler this test controls by hand -- no real timers, matching the vehicle-client-pi harness's own controllableWaitHandler shape. */
function controllableHandler() {
	let resolveHandler!: (output: unknown) => void;
	let rejectHandler!: (error: unknown) => void;
	let reportProgress!: (progress: unknown) => void;
	let startedResolve!: () => void;
	const started = new Promise<void>((res) => {
		startedResolve = res;
	});
	const handler = (context: { reportProgress: (progress: unknown) => void }) => {
		reportProgress = context.reportProgress;
		startedResolve();
		return new Promise((resolve, reject) => {
			resolveHandler = resolve;
			rejectHandler = reject;
		});
	};
	return {
		handler,
		started,
		tick: (progress: unknown) => reportProgress(progress),
		succeed: (output: unknown) => resolveHandler(output),
		fail: (error: unknown) => rejectHandler(error),
	};
}

function buildRegistryAndStore(wait: ReturnType<typeof controllableHandler>): { registry: VehicleRegistry; jobStore: VehicleJobStore } {
	const registry = new VehicleRegistry({ name: "test-vehicle", version: "1.0.0", description: "Test Vehicle" });
	const operation = defineVehicleOperation({
		name: "ci.wait",
		version: 1,
		description: "A background-capable long-running watch.",
		input: inputSchema,
		output: outputSchema,
		effect: "read",
		idempotency: { mode: "safe" },
		longRunning: true,
		limits: LIMITS,
		background: { supported: true, defaultWakeBudget: WAKE_BUDGET, maxWakeBudget: WAKE_BUDGET },
	});
	registry.register(
		"test-owner",
		bindVehicleOperation(operation, () => wait.handler as never),
	);
	const jobStore = new VehicleJobStore(registry);
	return { registry, jobStore };
}

let server: ReturnType<typeof Bun.serve> | undefined;

afterEach(() => {
	server?.stop(true);
	server = undefined;
});

function startTestServer(jobStore: VehicleJobStore, registry: VehicleRegistry): { baseUrl: string; token: string } {
	const token = "test-token";
	const app = createVehicleHttpApp({ registry, token, jobStore });
	server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: app.fetch });
	return { baseUrl: `http://127.0.0.1:${server.port}`, token };
}

for (const transport of ["local", "http"] as const) {
	describe(`Vehicle Jobs via ${transport === "local" ? "LocalVehicleClient" : "RemoteVehicleClient (real HTTP)"}`, () => {
		function harness(): { client: VehicleClient; wait: ReturnType<typeof controllableHandler> } {
			const wait = controllableHandler();
			const { registry, jobStore } = buildRegistryAndStore(wait);
			if (transport === "local") return { client: new LocalVehicleClient(registry, { jobStore }), wait };
			const { baseUrl, token } = startTestServer(jobStore, registry);
			return { client: new RemoteVehicleClient({ baseUrl, token }), wait };
		}

		it("submitJob returns a jobId immediately, never waiting on the handler", async () => {
			const { client, wait } = harness();
			const { jobId } = await client.submitJob!("ci.wait", 1, { runId: "42" });
			expect(typeof jobId).toBe("string");
			await wait.started; // the job really did start running server-side
			wait.succeed({ status: "success" });
		});

		it("pollJob reports running, then succeeded with the handler's real output", async () => {
			const { client, wait } = harness();
			const { jobId } = await client.submitJob!("ci.wait", 1, { runId: "42" });
			await wait.started;

			const running = await client.pollJob!(jobId);
			expect(running.status).toBe("running");

			wait.succeed({ status: "success" });
			await Promise.resolve();
			await Promise.resolve();

			const terminal = await client.pollJob!(jobId);
			expect(terminal.status).toBe("succeeded");
			expect(terminal.output).toEqual({ status: "success" });
		});

		it("tailJob accumulates every progress tick, cursor advancing each time", async () => {
			const { client, wait } = harness();
			const { jobId } = await client.submitJob!("ci.wait", 1, { runId: "42" });
			await wait.started;

			wait.tick({ status: "queued" });
			wait.tick({ status: "in_progress" });

			const firstTail = await client.tailJob!(jobId);
			expect(firstTail.entries.map((e) => e.progress)).toEqual([{ status: "queued" }, { status: "in_progress" }]);
			expect(firstTail.cursor).toBe(2);

			const secondTail = await client.tailJob!(jobId, firstTail.cursor);
			expect(secondTail.entries).toEqual([]);

			wait.succeed({ status: "success" });
		});

		it("cancelJob stops a still-running job instead of waiting it out", async () => {
			const { client, wait } = harness();
			const { jobId } = await client.submitJob!("ci.wait", 1, { runId: "42" });
			await wait.started;

			await client.cancelJob!(jobId);
			wait.fail(new Error("aborted"));
			await Promise.resolve();
			await Promise.resolve();

			const poll = await client.pollJob!(jobId);
			expect(poll.status).toBe("canceled");
			expect(poll.terminationReason).toBe("canceled");
		});

		it("pollJob against an unknown jobId fails with the real VehicleError shape, not a generic HTTP error", async () => {
			const { client } = harness();
			const failure = await client.pollJob!("no-such-job").catch((error: unknown) => error);
			expect(isVehicleError(failure)).toBe(true);
			expect((failure as { code: string }).code).toBe("job-not-found");
		});
	});
}

describe("LocalVehicleClient: jobs are opt-in", () => {
	it("throws jobs-not-configured when constructed without a jobStore, matching RemoteVehicleClient's 404 when its daemon never wired one up", async () => {
		const registry = new VehicleRegistry({ name: "test-vehicle", version: "1.0.0", description: "Test Vehicle" });
		const client = new LocalVehicleClient(registry);
		const failure = await client.submitJob!("ci.wait", 1, { runId: "1" }).catch((error: unknown) => error);
		expect(isVehicleError(failure)).toBe(true);
		expect((failure as { code: string }).code).toBe("jobs-not-configured");
	});
});

describe("RemoteVehicleClient: jobs are opt-in", () => {
	it("every job route 404s (Vehicle Jobs are not supported by this daemon) when the server never configured a jobStore", async () => {
		const wait = controllableHandler();
		const { registry } = buildRegistryAndStore(wait);
		const token = "test-token";
		const app = createVehicleHttpApp({ registry, token }); // no jobStore
		server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: app.fetch });
		const client = new RemoteVehicleClient({ baseUrl: `http://127.0.0.1:${server.port}`, token });

		await expect(client.submitJob!("ci.wait", 1, { runId: "1" })).rejects.toThrow();
		await expect(client.pollJob!("anything")).rejects.toThrow();
	});
});
