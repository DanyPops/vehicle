import { cloneJson, type JsonSchema } from "./json.js";

export interface VehicleSchemaIssue {
	readonly path: readonly (string | number)[];
	readonly message: string;
}

export type VehicleSchemaResult<T> =
	| { readonly success: true; readonly value: T }
	| { readonly success: false; readonly issues?: readonly VehicleSchemaIssue[] };

/**
 * A serializable, descriptive `jsonSchema` (surfaced to a client or Pi tool
 * projection) paired with a real `safeParse` that actually enforces it at
 * runtime -- a Vehicle registry's own `invoke()` only ever calls
 * `safeParse`; `jsonSchema` alone is never itself enforced, so a codec that
 * only sets `jsonSchema` without a matching `safeParse` is a documentation
 * gesture, not an honest contract.
 */
export interface VehicleSchemaCodec<T> {
	readonly jsonSchema: JsonSchema;
	safeParse(value: unknown): VehicleSchemaResult<T>;
}

export function defineVehicleSchema<T>(codec: VehicleSchemaCodec<T>): VehicleSchemaCodec<T> {
	return Object.freeze({
		jsonSchema: cloneJson(codec.jsonSchema),
		safeParse: codec.safeParse,
	});
}
