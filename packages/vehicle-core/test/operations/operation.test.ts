import { describe, expect, it } from "bun:test";
import { defineVehicleOperation } from "../../src/operations/operation.ts";
import { passthroughVehicleSchema } from "../../src/schemas/loose-object.ts";

const BASE_OPERATION_OPTIONS = {
	name: "test.job",
	version: 1,
	description: "Test operation.",
	input: passthroughVehicleSchema,
	output: passthroughVehicleSchema,
	effect: "read",
	idempotency: { mode: "safe" },
	limits: { defaultTimeoutMs: 1_000, maxTimeoutMs: 5_000, maxRequestBytes: 1_024, maxResponseBytes: 1_024 },
} as const;

describe("defineVehicleOperation background capability", () => {
	it("requires longRunning: true alongside a background capability", () => {
		expect(() =>
			defineVehicleOperation({
				...BASE_OPERATION_OPTIONS,
				background: {
					supported: true,
					defaultWakeBudget: { maxCount: 10, maxBytes: 1_000 },
					maxWakeBudget: { maxCount: 100, maxBytes: 10_000 },
				},
			}),
		).toThrow("longRunning");
	});

	it("rejects a non-positive-integer wake budget field", () => {
		expect(() =>
			defineVehicleOperation({
				...BASE_OPERATION_OPTIONS,
				longRunning: true,
				background: {
					supported: true,
					defaultWakeBudget: { maxCount: 0, maxBytes: 1_000 },
					maxWakeBudget: { maxCount: 100, maxBytes: 10_000 },
				},
			}),
		).toThrow("defaultWakeBudget.maxCount");
	});

	it("rejects a default wake budget exceeding the max wake budget", () => {
		expect(() =>
			defineVehicleOperation({
				...BASE_OPERATION_OPTIONS,
				longRunning: true,
				background: {
					supported: true,
					defaultWakeBudget: { maxCount: 200, maxBytes: 1_000 },
					maxWakeBudget: { maxCount: 100, maxBytes: 10_000 },
				},
			}),
		).toThrow("defaultWakeBudget.maxCount must not exceed maxWakeBudget.maxCount");
	});

	it("accepts a well-formed background capability and freezes it onto the descriptor", () => {
		const operation = defineVehicleOperation({
			...BASE_OPERATION_OPTIONS,
			longRunning: true,
			background: {
				supported: true,
				defaultWakeBudget: { maxCount: 10, maxBytes: 1_000 },
				maxWakeBudget: { maxCount: 100, maxBytes: 10_000 },
			},
		});
		expect(operation.descriptor.background).toEqual({
			supported: true,
			defaultWakeBudget: { maxCount: 10, maxBytes: 1_000 },
			maxWakeBudget: { maxCount: 100, maxBytes: 10_000 },
		});
		expect(Object.isFrozen(operation.descriptor.background)).toBe(true);
	});

	it("omits background entirely from the descriptor when not declared", () => {
		const operation = defineVehicleOperation(BASE_OPERATION_OPTIONS);
		expect(operation.descriptor.background).toBeUndefined();
		expect("background" in operation.descriptor).toBe(false);
	});
});
