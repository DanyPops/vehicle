import { describe, expect, it } from "bun:test";
import { bindVehicleOperation, defineLooseObjectSchema, defineVehicleOperation, passthroughVehicleSchema } from "@danypops/vehicle-core";
import { VehicleRegistry } from "../src/vehicle-registry.ts";
import { createVehicleMetricsMiddleware } from "../src/vehicle-metrics-middleware.ts";
import { openVehicleMetricsStore } from "../src/vehicle-metrics-store.ts";
import { registerVehicleMetricsOperations } from "../src/vehicle-metrics-operations.ts";

const LIMITS = { defaultTimeoutMs: 5_000, maxTimeoutMs: 30_000, maxRequestBytes: 65_536, maxResponseBytes: 262_144 };

function wiredRegistry() {
	const registry = new VehicleRegistry({ name: "test-vehicle", version: "1", description: "Test." });
	const store = openVehicleMetricsStore(":memory:");
	registry.useExecutionMiddleware(createVehicleMetricsMiddleware(store, "test-vehicle"));
	registerVehicleMetricsOperations(registry, store, "test-vehicle");
	return { registry, store };
}

describe("registerVehicleMetricsOperations", () => {
	it("registers metrics.query and metrics.recordClientEvent on the manifest, effect-classified correctly", () => {
		const { registry } = wiredRegistry();
		const manifest = registry.manifest();
		const query = manifest.operations.find((op) => op.name === "metrics.query");
		const record = manifest.operations.find((op) => op.name === "metrics.recordClientEvent");
		expect(query?.effect).toBe("read");
		expect(record?.effect).toBe("local-write");
	});

	it("metrics.query is discoverable and callable, and reflects invocations recorded directly against the store", async () => {
		const { registry, store } = wiredRegistry();
		store.record({ source: "server", vehicleName: "test-vehicle", toolName: "tasks.create", outcome: "success" });
		store.record({ source: "server", vehicleName: "test-vehicle", toolName: "tasks.create", outcome: "success" });

		// Note: this real invoke() call is itself recorded by the middleware (toolName: "metrics.query") --
		// filtering to the toolName under test avoids that self-recording skewing the assertion.
		const result = (await registry.invoke("metrics.query", 1, { toolName: "tasks.create" }, { permissions: [] })) as { count: number }[];
		expect(result[0]?.count).toBe(2);
	});

	it("metrics.query supports groupBy and time-range filters through the real operation call", async () => {
		const { registry, store } = wiredRegistry();
		store.record({ source: "server", vehicleName: "test-vehicle", toolName: "tasks.create", outcome: "success", ts: 1_000 });
		store.record({ source: "server", vehicleName: "test-vehicle", toolName: "tasks.create", outcome: "failure", ts: 2_000 });

		const grouped = (await registry.invoke("metrics.query", 1, { toolName: "tasks.create", groupBy: ["toolName"] }, { permissions: [] })) as {
			key: { toolName: string };
			count: number;
		}[];
		expect(grouped.find((row) => row.key.toolName === "tasks.create")?.count).toBe(2);

		const ranged = (await registry.invoke("metrics.query", 1, { toolName: "tasks.create", since: 1_500 }, { permissions: [] })) as { count: number }[];
		expect(ranged[0]?.count).toBe(1);
	});

	it("metrics.query rejects an invalid source filter -- enforced by the input schema's own enum, before the handler ever runs", async () => {
		const { registry } = wiredRegistry();
		await expect(registry.invoke("metrics.query", 1, { source: "bogus" }, { permissions: [] })).rejects.toThrow(/invalid input/);
	});

	it("metrics.recordClientEvent records a real client-reported shell meta-tool call, source: client", async () => {
		const { registry, store } = wiredRegistry();
		await registry.invoke("metrics.recordClientEvent", 1, { toolName: "tools_list", outcome: "success", durationMs: 5 }, { permissions: [] });

		const rows = store.query({ source: "client" });
		expect(rows[0]?.count).toBe(1);
	});

	it("metrics.recordClientEvent rejects a tool name outside the known shell-tool enum", async () => {
		const { registry } = wiredRegistry();
		await expect(registry.invoke("metrics.recordClientEvent", 1, { toolName: "papyrus:tasks.create", outcome: "success" }, { permissions: [] })).rejects.toThrow();
	});

	it("metrics.recordClientEvent rejects a missing required field", async () => {
		const { registry } = wiredRegistry();
		await expect(registry.invoke("metrics.recordClientEvent", 1, { toolName: "tools_list" }, { permissions: [] })).rejects.toThrow();
	});

	it("metrics.recordClientEvent falls back to the real invocation's own callerSessionId/callerProjectRoot when the input omits them", async () => {
		const { registry, store } = wiredRegistry();
		await registry.invoke(
			"metrics.recordClientEvent",
			1,
			{ toolName: "tools_man", outcome: "success" },
			{ permissions: [], callerSessionId: "session-9", callerProjectRoot: "/home/x" },
		);
		// 2, not 1: the middleware also auto-records this very invoke() call itself (toolName:
		// "metrics.recordClientEvent", source: "server") under the same real callerSessionId --
		// filtering to source: "client" isolates the handler's own explicit report.
		const rows = store.query({ callerSessionId: "session-9", source: "client" });
		expect(rows[0]?.count).toBe(1);
	});
});

describe("registerVehicleMetricsOperations: operationPrefix override", () => {
	it("registers under a caller-chosen prefix instead of the default 'metrics', for a Vehicle whose own domain already owns that namespace", async () => {
		const registry = new VehicleRegistry({ name: "jittor", version: "1", description: "Test." });
		const store = openVehicleMetricsStore(":memory:");
		registerVehicleMetricsOperations(registry, store, "jittor", { operationPrefix: "vehicle_usage" });

		const manifest = registry.manifest();
		const names = manifest.operations.map((op) => op.name);
		expect(names).toContain("vehicle_usage.query");
		expect(names).toContain("vehicle_usage.recordClientEvent");
		expect(names).not.toContain("metrics.query");
		expect(names).not.toContain("metrics.recordClientEvent");

		const result = (await registry.invoke("vehicle_usage.query", 1, {}, { permissions: [] })) as { count: number }[];
		expect(result[0]?.count).toBe(0); // no middleware wired in this test -- nothing has been recorded yet
	});

	it("never collides with a Vehicle's own pre-existing 'metrics.*' operations -- the real motivating scenario", () => {
		const registry = new VehicleRegistry({ name: "jittor", version: "1", description: "Test." });
		const domainMetricsOperation = defineVehicleOperation({
			name: "metrics.query",
			version: 1,
			description: "Jittor's own real domain operation -- LLM usage/cost observations, unrelated to tool-usage metrics.",
			input: defineLooseObjectSchema({}, []),
			output: passthroughVehicleSchema,
			effect: "read",
			idempotency: { mode: "safe" },
			limits: LIMITS,
		});
		registry.register(
			"jittor",
			bindVehicleOperation(domainMetricsOperation, () => async () => []),
		);

		const store = openVehicleMetricsStore(":memory:");
		expect(() => registerVehicleMetricsOperations(registry, store, "jittor", { operationPrefix: "vehicle_usage" })).not.toThrow();
	});
});
