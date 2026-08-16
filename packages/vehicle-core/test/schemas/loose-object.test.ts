import { describe, expect, it } from "bun:test";
import { defineLooseObjectSchema, passthroughVehicleSchema } from "../../src/schemas/loose-object.ts";

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
