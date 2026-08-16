import { defineVehicleSchema, type VehicleSchemaCodec } from "./codec.js";
import type { JsonValue } from "./json.js";

export interface LooseObjectProperty {
	readonly type: string;
	readonly enum?: readonly string[];
}

/** JSON Schema's own `type` keyword vocabulary -- checked for real below so a declared `type: "number"` (say) can't silently accept a string forever. `"integer"` additionally requires no fractional part, matching JSON Schema's own distinction from plain `"number"`. An unrecognized type name is treated as "anything goes" (matches passthroughVehicleSchema's own precedent for a shape not worth strictly enforcing) rather than rejecting every input outright for what would otherwise be a schema-authoring typo. */
function matchesLooseObjectPropertyType(type: string, value: unknown): boolean {
	switch (type) {
		case "string":
			return typeof value === "string";
		case "number":
			return typeof value === "number" && Number.isFinite(value);
		case "integer":
			return typeof value === "number" && Number.isInteger(value);
		case "boolean":
			return typeof value === "boolean";
		case "object":
			return typeof value === "object" && value !== null && !Array.isArray(value);
		case "array":
			return Array.isArray(value);
		case "null":
			return value === null;
		default:
			return true;
	}
}

/**
 * A VehicleRegistry only ever calls a schema's own safeParse -- jsonSchema is
 * descriptive metadata surfaced to a client/Pi projection, never itself
 * enforced at runtime -- so a declared `type`/`enum`/`additionalProperties: false`
 * has to be checked here for real, or it's a documentation gesture, not an
 * honest contract (the exact drift this function's own jsonSchema metadata
 * had before: it always advertised `additionalProperties: false` and a
 * per-property `type`, while safeParse only ever checked `required` and
 * `enum`). Every consumer projecting a plain-object input onto a
 * VehicleOperation needs the same required/type/extra-key/enum checks; this
 * is that check written once.
 */
export function defineLooseObjectSchema(
	properties: Record<string, LooseObjectProperty>,
	required: readonly string[] = [],
): VehicleSchemaCodec<Record<string, unknown>> {
	return defineVehicleSchema<Record<string, unknown>>({
		// LooseObjectProperty's named fields (type, enum) are all JSON-value-shaped
		// at runtime, but TypeScript's structural check against the recursive
		// JsonValue union doesn't see that through a plain interface -- the cast
		// is a type-system limitation, not a runtime concern.
		jsonSchema: { type: "object", properties: properties as unknown as JsonValue, required: [...required], additionalProperties: false },
		safeParse(value) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) {
				return { success: false, issues: [{ path: [], message: "input must be an object" }] };
			}
			const input = value as Record<string, unknown>;
			for (const key of required) {
				if (!(key in input)) return { success: false, issues: [{ path: [key], message: `${key} is required` }] };
			}
			for (const key of Object.keys(input)) {
				if (!(key in properties)) return { success: false, issues: [{ path: [key], message: `${key} is not a recognized property` }] };
			}
			for (const [key, schema] of Object.entries(properties)) {
				if (!(key in input)) continue;
				if (!matchesLooseObjectPropertyType(schema.type, input[key])) {
					return { success: false, issues: [{ path: [key], message: `${key} must be of type ${schema.type}` }] };
				}
				if (schema.enum && !schema.enum.includes(input[key] as string)) {
					return { success: false, issues: [{ path: [key], message: `${key} must be one of ${schema.enum.join(", ")}` }] };
				}
			}
			return { success: true, value: input };
		},
	});
}

/** Accepts any value unvalidated -- for an operation whose output shape isn't worth a dedicated schema (an internal/low-stakes result, or one already validated upstream by the domain logic it wraps). */
export const passthroughVehicleSchema: VehicleSchemaCodec<unknown> = defineVehicleSchema<unknown>({
	jsonSchema: { type: "object" },
	safeParse: (value) => ({ success: true, value }),
});
