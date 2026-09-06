import type { Static, TSchema } from "typebox";
import { Check } from "typebox/schema";
import { VEHICLE_EFFECTS } from "../operations/effect.js";
import { type DefineVehicleOperationOptions, defineVehicleOperation, type VehicleOperation } from "../operations/operation.js";
import { snapshotVehicleJson } from "../schemas/bounded-json.js";
import type { VehicleSchemaCodec } from "../schemas/codec.js";
import { strictVehicleJsonSchema } from "../schemas/strict-profile.js";

export type StrictVehicleOperationOptions<Input extends TSchema, Output extends TSchema> = Omit<
	DefineVehicleOperationOptions<Static<Input>, Static<Output>>,
	"input" | "output" | "permissions"
> & {
	readonly input: Input;
	readonly output: Output;
	readonly permissions: readonly string[];
};

/** Builds runtime codecs and published schemas from one typed definition, with explicit permissions. */
export function defineStrictVehicleOperation<const Input extends TSchema, const Output extends TSchema>(
	options: StrictVehicleOperationOptions<Input, Output>,
): VehicleOperation<Static<Input>, Static<Output>> {
	for (const bound of [
		options.limits.defaultTimeoutMs,
		options.limits.maxTimeoutMs,
		options.limits.maxRequestBytes,
		options.limits.maxResponseBytes,
	]) {
		if (!Number.isSafeInteger(bound) || bound < 1) throw new Error("Operation limits must be positive safe integers");
	}
	if (
		!VEHICLE_EFFECTS.includes(options.effect) ||
		!["safe", "keyed", "unsafe"].includes(options.idempotency.mode) ||
		(options.requiresApproval !== undefined && typeof options.requiresApproval !== "boolean") ||
		(options.streaming !== undefined && typeof options.streaming !== "boolean") ||
		(options.longRunning !== undefined && typeof options.longRunning !== "boolean") ||
		options.name.length > 128 ||
		options.description.length > 2048 ||
		!Number.isSafeInteger(options.version) ||
		options.permissions.length > 64 ||
		options.permissions.some((permission) => permission.length > 128) ||
		(options.errors?.length ?? 0) > 64 ||
		options.errors?.some((error) => !error.code || error.code.length > 128 || error.description.length > 2048)
	)
		throw new Error("Operation metadata exceeds contract bounds");
	return defineVehicleOperation({
		...options,
		input: defineStrictVehicleSchema(options.input, { maxBytes: options.limits.maxRequestBytes }),
		output: defineStrictVehicleSchema(options.output, { maxBytes: options.limits.maxResponseBytes }),
	});
}

export interface StrictVehicleSchemaOptions {
	/** Serialized JSON ceiling, from 1 byte through 1 MiB; defaults to 64 KiB. */
	readonly maxBytes?: number;
}

/**
 * Infers a codec from TypeBox, enforcing the same immutable JSON Schema at runtime.
 * Supports bounded strings, numeric ranges, primitive literals, closed records, bounded dictionaries,
 * arrays and unions. References, regex patterns and custom formats require a separate reviewed codec.
 * Values are copied; coercion and defaults are disabled. Schema ceilings are 64 KiB, 512 nodes and
 * depth 16; value ceilings are 65,536 nodes and depth 32 in addition to maxBytes.
 *
 * @example
 * const input = defineStrictVehicleSchema(Type.Object({
 *   limit: Type.Integer({ minimum: 1, maximum: 100 }),
 * }, { additionalProperties: false }));
 */
export function defineStrictVehicleSchema<const Schema extends TSchema>(
	schema: Schema,
	options: StrictVehicleSchemaOptions = {},
): VehicleSchemaCodec<Static<Schema>> {
	const jsonSchema = strictVehicleJsonSchema(schema);
	const maxBytes = options.maxBytes ?? 65_536;
	if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 1_048_576) throw new Error("Invalid schema byte ceiling");
	return Object.freeze({
		jsonSchema,
		safeParse(value: unknown) {
			try {
				const snapshot = snapshotVehicleJson(value, maxBytes);
				if (Check(jsonSchema, snapshot)) return { success: true as const, value: snapshot as Static<Schema> };
			} catch {
				// Boundary diagnostics exclude caller data and validator internals.
			}
			return { success: false as const, issues: [{ path: [], message: "Value violates the bounded operation schema." }] };
		},
	});
}
