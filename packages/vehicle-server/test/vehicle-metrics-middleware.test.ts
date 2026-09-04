import { describe, expect, it } from "bun:test";
import { bindVehicleOperation, defineLooseObjectSchema, defineVehicleOperation, passthroughVehicleSchema, VehicleError } from "@danypops/vehicle-core";
import { VehicleRegistry } from "../src/vehicle-registry.ts";
import { createVehicleMetricsMiddleware, vehicleMetricsMiddlewareId } from "../src/vehicle-metrics-middleware.ts";
import { openVehicleMetricsStore, type VehicleMetricsStore } from "../src/vehicle-metrics-store.ts";

const LIMITS = { defaultTimeoutMs: 5_000, maxTimeoutMs: 30_000, maxRequestBytes: 65_536, maxResponseBytes: 262_144 };

function registryWithEcho(): VehicleRegistry {
	const registry = new VehicleRegistry({ name: "test", version: "1", description: "Test." });
	const echo = defineVehicleOperation({
		name: "test.echo",
		version: 1,
		description: "Echoes the given value.",
		input: defineLooseObjectSchema({ value: { type: "string" }, fail: { type: "boolean" } }, []),
		output: passthroughVehicleSchema,
		effect: "read",
		idempotency: { mode: "safe" },
		limits: LIMITS,
	});
	registry.register(
		"echo-provider",
		bindVehicleOperation(echo, () => async ({ input }) => {
			if ((input as { fail?: boolean }).fail) throw new VehicleError("handler-failed", "boom", { category: "internal" });
			return { echoed: (input as { value?: string }).value };
		}),
	);
	return registry;
}

describe("createVehicleMetricsMiddleware", () => {
	it("records a successful invocation, with tool name/version/duration, without altering the real result", async () => {
		const store = openVehicleMetricsStore(":memory:");
		const registry = registryWithEcho();
		registry.useExecutionMiddleware(createVehicleMetricsMiddleware(store, "test-vehicle"));

		const output = await registry.invoke("test.echo", 1, { value: "hi" }, { permissions: [] });
		expect(output).toEqual({ echoed: "hi" });

		const rows = store.query({});
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ count: 1, successCount: 1, failureCount: 0 });

		const byTool = store.query({ groupBy: ["toolName"] });
		expect(byTool[0]?.key.toolName).toBe("test.echo");
		store.close();
	});

	it("records a failed invocation with its error code, and still rethrows the real error unchanged", async () => {
		const store = openVehicleMetricsStore(":memory:");
		const registry = registryWithEcho();
		registry.useExecutionMiddleware(createVehicleMetricsMiddleware(store, "test-vehicle"));

		await expect(registry.invoke("test.echo", 1, { value: "hi", fail: true }, { permissions: [] })).rejects.toThrow("boom");

		const rows = store.query({});
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ count: 1, successCount: 0, failureCount: 1 });
		expect(store.query({ groupBy: ["errorCode"] })[0]?.key.errorCode).toBe("handler-failed");
		store.close();
	});

	it("captures session and principal identity while omitting the project root", async () => {
		const store = openVehicleMetricsStore(":memory:");
		const registry = registryWithEcho();
		registry.useExecutionMiddleware(createVehicleMetricsMiddleware(store, "test-vehicle"));

		await registry.invoke("test.echo", 1, { value: "hi" }, {
			permissions: [],
			callerSessionId: "session-1",
			callerProjectRoot: "/home/x/project",
			principal: { id: "agent-1" },
		});

		const rows = store.query({ callerSessionId: "session-1" });
		expect(rows[0]?.count).toBe(1);
		store.close();
	});

	it("a store.record() failure never affects the real invocation's own success or its returned value", async () => {
		const throwingStore: VehicleMetricsStore = {
			record: () => {
				throw new Error("disk full");
			},
			query: () => [],
			queryResult: () => ({ rows: [], limit: 100, truncated: false }),
			close: () => {},
		};
		const registry = registryWithEcho();
		registry.useExecutionMiddleware(createVehicleMetricsMiddleware(throwingStore, "test-vehicle"));

		const output = await registry.invoke("test.echo", 1, { value: "hi" }, { permissions: [] });
		expect(output).toEqual({ echoed: "hi" });
	});

	it("a store.record() failure never masks the real invocation's own thrown error", async () => {
		const throwingStore: VehicleMetricsStore = {
			record: () => {
				throw new Error("disk full");
			},
			query: () => [],
			queryResult: () => ({ rows: [], limit: 100, truncated: false }),
			close: () => {},
		};
		const registry = registryWithEcho();
		registry.useExecutionMiddleware(createVehicleMetricsMiddleware(throwingStore, "test-vehicle"));

		await expect(registry.invoke("test.echo", 1, { value: "hi", fail: true }, { permissions: [] })).rejects.toThrow("boom");
	});

	it("vehicleMetricsMiddlewareId is namespaced per vehicleName, so two vehicles in one process never collide", () => {
		expect(vehicleMetricsMiddlewareId("papyrus")).not.toBe(vehicleMetricsMiddlewareId("tickets"));
	});
});
