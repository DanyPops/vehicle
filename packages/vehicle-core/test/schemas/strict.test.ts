import { expect, it } from "bun:test";
import { type TSchema, Type } from "typebox";
import { Check } from "typebox/schema";
import { defineStrictVehicleSchema } from "../../src/typebox/index.ts";

const shape = Type.Object(
	{
		rows: Type.Array(
			Type.Object(
				{
					name: Type.String({ minLength: 1, maxLength: 4 }),
					count: Type.Integer({ minimum: 0, maximum: 10 }),
					state: Type.Union([Type.Literal("ok"), Type.Null()]),
				},
				{ additionalProperties: false },
			),
			{ minItems: 1, maxItems: 2 },
		),
	},
	{ additionalProperties: false },
);
const valid = { rows: [{ name: "test", count: 2, state: "ok" }] };

it.each([
	valid,
	{ rows: [{ name: "😀😀", count: 0, state: null }] },
	{ rows: [{ name: "12345", count: 2, state: "ok" }] },
	{ rows: [{ name: "test", count: 1.5, state: "ok" }] },
	{ rows: [{ name: "test", count: 11, state: "ok" }] },
	{ rows: [{ name: "test", count: 2, state: "other" }] },
	{ rows: [{ name: "test", count: 2, state: "ok", extra: true }] },
	{ rows: [] },
	{ rows: Array(3).fill(valid.rows[0]) },
	{ ...valid, extra: true },
	{},
] as unknown[])("agrees with published JSON Schema", (value) => {
	const codec = defineStrictVehicleSchema(shape);
	expect(codec.safeParse(value).success).toBe(Check(codec.jsonSchema, value));
});

it.each([
	Type.String(),
	Type.Array(Type.Boolean()),
	Type.Number(),
	Type.Object({}),
	Type.Any(),
	Type.Unknown(),
	Type.Unsafe({ $ref: "https://example.invalid/schema" }),
	Type.String({ maxLength: 8, pattern: "(a+)+$" }),
	Type.String({ maxLength: -1 }),
	Type.Number({ minimum: 4, maximum: 1 }),
	Type.Unsafe({ type: "array", maxItems: 2 }),
	Type.Unsafe({ type: "object", additionalProperties: false, properties: {}, required: ["missing"] }),
	Type.Unsafe({ type: "string", maxLength: 4, ignoredConstraint: true }),
	Type.Unsafe({ type: "string", const: "ok", enum: "invalid" }),
	Type.Unsafe({ anyOf: [{ type: "boolean" }], oneOf: null }),
])("rejects unsupported or unbounded schemas", (schema) => {
	expect(() => defineStrictVehicleSchema(schema)).toThrow();
});

it("handles Unicode and prototype-shaped keys", () => {
	const codec = defineStrictVehicleSchema(shape);
	expect(codec.safeParse({ rows: [{ name: "😀😀😀😀", count: 1, state: null }] }).success).toBe(true);
	for (const key of ["__proto__", "constructor", "toString"]) {
		const input = Object.fromEntries([...Object.entries(valid), [key, "extra"]]);
		expect(codec.safeParse(input).success).toBe(false);
	}
});

it("supports bounded dictionaries", () => {
	const codec = defineStrictVehicleSchema(
		Type.Unsafe({
			type: "object",
			maxProperties: 2,
			propertyNames: { type: "string", maxLength: 4 },
			additionalProperties: { type: "boolean" },
		}),
	);
	expect(codec.safeParse({ a: true }).success).toBe(true);
	expect(codec.safeParse({ longName: true }).success).toBe(false);
	expect(codec.safeParse({ a: true, b: true, c: true }).success).toBe(false);
});

it("enforces byte bounds before validation", () => {
	const codec = defineStrictVehicleSchema(Type.String({ maxLength: 100 }), { maxBytes: 16 });
	expect(codec.safeParse("😀😀😀😀").success).toBe(false);
	expect(codec.safeParse("ok").success).toBe(true);
});

it("snapshots schemas and values", () => {
	const schema = Type.String({ maxLength: 4 });
	const codec = defineStrictVehicleSchema(schema);
	Object.assign(schema, { maxLength: 100 });
	expect(codec.safeParse("12345").success).toBe(false);
	expect(Object.isFrozen(codec.jsonSchema)).toBe(true);
	const input = { rows: [{ name: "test", count: 2, state: "ok" }] };
	const parsed = defineStrictVehicleSchema(shape).safeParse(input);
	input.rows[0]!.name = "changed";
	expect(parsed.success && parsed.value.rows[0]?.name).toBe("test");
});

it("rejects non-JSON values and accessors", () => {
	const codec = defineStrictVehicleSchema(shape);
	let reads = 0;
	const getter = Object.defineProperty({}, "rows", {
		enumerable: true,
		get() {
			reads++;
			return valid.rows;
		},
	});
	const cyclic: Record<string, unknown> = {};
	cyclic["rows"] = [cyclic];
	for (const input of [
		getter,
		cyclic,
		undefined,
		{ rows: [undefined] },
		{ rows: [{ name: "test", count: NaN, state: "ok" }] },
		Object.create(valid),
	]) {
		expect(codec.safeParse(input).success).toBe(false);
	}
	expect(reads).toBe(0);
});

it("bounds schema depth and rejects invalid limits", () => {
	let schema: TSchema = Type.Boolean();
	for (let i = 0; i < 40; i++) schema = Type.Unsafe({ type: "array", maxItems: 1, items: schema });
	expect(() => defineStrictVehicleSchema(schema)).toThrow();
	for (const maxBytes of [0, -1, Infinity, 1.5, 2 ** 30]) expect(() => defineStrictVehicleSchema(Type.Boolean(), { maxBytes })).toThrow();
});

it("infers the validated value type", () => {
	const parsed = defineStrictVehicleSchema(shape).safeParse(valid);
	if (parsed.success) {
		const count: number | undefined = parsed.value.rows[0]?.count;
		expect(count).toBe(2);
		// @ts-expect-error Counts are numeric in the operation contract.
		const wrong: string = parsed.value.rows[0]!.count;
		void wrong;
	}
});
