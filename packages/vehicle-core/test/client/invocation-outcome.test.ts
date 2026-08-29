import { describe, expect, it } from "bun:test";
import type { VehicleClient, VehicleInvocationOptions, VehicleManifest } from "../../src/index.js";
import { invokeVehicleOutcome, VehicleError } from "../../src/index.js";

function client(invocation: () => Promise<unknown>): VehicleClient {
	return {
		manifest: async (): Promise<VehicleManifest> => ({ name: "test", version: "1", description: "Test.", operations: [] }),
		async invoke<Output = unknown>() {
			return (await invocation()) as Output;
		},
		close: async () => {},
	};
}

const options: VehicleInvocationOptions = { operationId: "operation-1" };

describe("invokeVehicleOutcome", () => {
	it("returns a typed success without changing the client invoke contract", async () => {
		const outcome = await invokeVehicleOutcome<{ value: string }>(client(async () => ({ value: "ok" })), "test.echo", 1, {}, options);
		expect(outcome).toEqual({ ok: true, value: { value: "ok" } });
	});

	it("preserves every wire-safe Vehicle failure field", async () => {
		const error = new VehicleError("permission-denied", "Permission denied", {
			category: "authorization",
			retryable: false,
			details: { permission: "test:read" },
			operationId: "operation-1",
		});
		const outcome = await invokeVehicleOutcome(client(async () => Promise.reject(error)), "test.echo", 1, {}, options);
		expect(outcome).toEqual({ ok: false, kind: "vehicle-failure", failure: error.toFailure() });
	});

	it("classifies caller cancellation separately", async () => {
		const error = new DOMException("aborted", "AbortError");
		const outcome = await invokeVehicleOutcome(client(async () => Promise.reject(error)), "test.echo", 1, {}, options);
		expect(outcome).toEqual({ ok: false, kind: "cancelled", message: "Vehicle invocation was cancelled", operationId: "operation-1" });
	});

	it("classifies transport failures without exposing their raw message", async () => {
		const outcome = await invokeVehicleOutcome(
			client(async () => Promise.reject(new TypeError("fetch failed: bearer secret"))),
			"test.echo",
			1,
			{},
			options,
		);
		expect(outcome).toEqual({ ok: false, kind: "transport-failure", message: "Vehicle transport failed", retryable: true, operationId: "operation-1" });
	});

	it("bounds and sanitizes an unexpected failure", async () => {
		const outcome = await invokeVehicleOutcome(client(async () => Promise.reject(new Error("secret".repeat(1_000)))), "test.echo", 1, {}, options);
		expect(outcome).toEqual({ ok: false, kind: "unexpected-failure", message: "Vehicle invocation failed unexpectedly", operationId: "operation-1" });
		if (outcome.ok || outcome.kind !== "unexpected-failure") throw new Error("expected an unexpected-failure outcome");
		expect(outcome.message.length).toBeLessThanOrEqual(200);
	});
});
