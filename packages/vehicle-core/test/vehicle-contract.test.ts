import { describe, expect, it } from "bun:test";
import {
	defineLooseObjectSchema,
	defineVehicleOperation,
	extractVehicleContent,
	passthroughVehicleSchema,
} from "../src/vehicle-contract.ts";

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

describe("defineLooseObjectSchema", () => {
	it("rejects a non-object input", () => {
		const schema = defineLooseObjectSchema({ name: { type: "string" } });
		expect(schema.safeParse("nope")).toEqual({ success: false, issues: [{ path: [], message: "input must be an object" }] });
		expect(schema.safeParse(null)).toEqual({ success: false, issues: [{ path: [], message: "input must be an object" }] });
		expect(schema.safeParse(["array"])).toEqual({ success: false, issues: [{ path: [], message: "input must be an object" }] });
	});

	it("rejects a missing required field", () => {
		const schema = defineLooseObjectSchema({ id: { type: "string" }, name: { type: "string" } }, ["id"]);
		const result = schema.safeParse({ name: "x" });
		expect(result).toEqual({ success: false, issues: [{ path: ["id"], message: "id is required" }] });
	});

	it("accepts an object with every required field present", () => {
		const schema = defineLooseObjectSchema({ id: { type: "string" } }, ["id"]);
		expect(schema.safeParse({ id: "abc" })).toEqual({ success: true, value: { id: "abc" } });
	});

	it("enforces a declared enum for real, not just as documentation", () => {
		const schema = defineLooseObjectSchema({ status: { type: "string", enum: ["draft", "active"] } });
		expect(schema.safeParse({ status: "bogus" })).toEqual({
			success: false,
			issues: [{ path: ["status"], message: "status must be one of draft, active" }],
		});
		expect(schema.safeParse({ status: "draft" })).toEqual({ success: true, value: { status: "draft" } });
	});

	it("skips the enum check entirely when the field is absent (not required)", () => {
		const schema = defineLooseObjectSchema({ status: { type: "string", enum: ["draft", "active"] } });
		expect(schema.safeParse({})).toEqual({ success: true, value: {} });
	});

	it("produces additionalProperties: false JSON Schema metadata carrying the declared properties/required", () => {
		const schema = defineLooseObjectSchema({ id: { type: "string" } }, ["id"]);
		expect(schema.jsonSchema).toEqual({
			type: "object",
			properties: { id: { type: "string" } },
			required: ["id"],
			additionalProperties: false,
		});
	});

	it("rejects a property whose runtime value doesn't match its declared type -- the published jsonSchema type is enforced, not just documentation", () => {
		const schema = defineLooseObjectSchema({ count: { type: "number" } });
		expect(schema.safeParse({ count: "5" })).toEqual({
			success: false,
			issues: [{ path: ["count"], message: "count must be of type number" }],
		});
		expect(schema.safeParse({ count: 5 })).toEqual({ success: true, value: { count: 5 } });
	});

	it("rejects NaN/Infinity for a declared 'number' property -- a wrong type in disguise, not a valid number", () => {
		const schema = defineLooseObjectSchema({ count: { type: "number" } });
		expect(schema.safeParse({ count: Number.NaN }).success).toBe(false);
		expect(schema.safeParse({ count: Number.POSITIVE_INFINITY }).success).toBe(false);
	});

	it("rejects a fractional value for a declared 'integer' property, accepting only a real integer", () => {
		const schema = defineLooseObjectSchema({ count: { type: "integer" } });
		expect(schema.safeParse({ count: 1.5 })).toEqual({
			success: false,
			issues: [{ path: ["count"], message: "count must be of type integer" }],
		});
		expect(schema.safeParse({ count: 1 })).toEqual({ success: true, value: { count: 1 } });
	});

	it("validates boolean, object, and array declared types for real", () => {
		const schema = defineLooseObjectSchema({ flag: { type: "boolean" }, meta: { type: "object" }, tags: { type: "array" } });
		expect(schema.safeParse({ flag: "yes" }).success).toBe(false);
		expect(schema.safeParse({ meta: [] }).success).toBe(false); // an array is not a plain object
		expect(schema.safeParse({ tags: {} }).success).toBe(false);
		expect(schema.safeParse({ flag: true, meta: { a: 1 }, tags: [1, 2] })).toEqual({
			success: true,
			value: { flag: true, meta: { a: 1 }, tags: [1, 2] },
		});
	});

	it("skips the type check entirely when the field is absent (not required), same as the existing enum-skip behavior", () => {
		const schema = defineLooseObjectSchema({ count: { type: "number" } });
		expect(schema.safeParse({})).toEqual({ success: true, value: {} });
	});

	it("rejects a property the schema never declared -- additionalProperties: false is enforced for real, not just advertised", () => {
		const schema = defineLooseObjectSchema({ id: { type: "string" } }, ["id"]);
		expect(schema.safeParse({ id: "abc", extra: "surprise" })).toEqual({
			success: false,
			issues: [{ path: ["extra"], message: "extra is not a recognized property" }],
		});
	});

	it("still accepts a well-formed input with no extra properties, unaffected by the new checks", () => {
		const schema = defineLooseObjectSchema({ id: { type: "string" }, count: { type: "number" } }, ["id"]);
		expect(schema.safeParse({ id: "abc", count: 3 })).toEqual({ success: true, value: { id: "abc", count: 3 } });
	});
});

describe("passthroughVehicleSchema", () => {
	it("accepts any value unvalidated", () => {
		expect(passthroughVehicleSchema.safeParse({ anything: 1 })).toEqual({ success: true, value: { anything: 1 } });
		expect(passthroughVehicleSchema.safeParse("a string")).toEqual({ success: true, value: "a string" });
		expect(passthroughVehicleSchema.safeParse(null)).toEqual({ success: true, value: null });
	});
});

describe("extractVehicleContent", () => {
	it("returns the content blocks when every element is a well-formed text block", () => {
		const output = { runId: "run-1", content: [{ type: "text", text: "Created run run-1." }] };
		expect(extractVehicleContent(output)).toEqual([{ type: "text", text: "Created run run-1." }]);
	});

	it("returns undefined when output has no content field", () => {
		expect(extractVehicleContent({ runId: "run-1" })).toBeUndefined();
	});

	it("returns undefined for a non-object, null, or array output", () => {
		expect(extractVehicleContent("a string")).toBeUndefined();
		expect(extractVehicleContent(null)).toBeUndefined();
		expect(extractVehicleContent([1, 2, 3])).toBeUndefined();
	});

	it("returns undefined when content is present but empty", () => {
		expect(extractVehicleContent({ content: [] })).toBeUndefined();
	});

	it("returns undefined when content is not an array", () => {
		expect(extractVehicleContent({ content: "not an array" })).toBeUndefined();
	});

	it("returns undefined when any block has an unsupported type or a non-string text", () => {
		expect(extractVehicleContent({ content: [{ type: "image", text: "x" }] })).toBeUndefined();
		expect(extractVehicleContent({ content: [{ type: "text", text: 42 }] })).toBeUndefined();
	});

	it("returns undefined when any block in the array is malformed, rather than the well-formed prefix", () => {
		const output = { content: [{ type: "text", text: "ok" }, "not a block"] };
		expect(extractVehicleContent(output)).toBeUndefined();
	});
});
