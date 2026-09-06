import type { JsonValue } from "./json.js";

/** Identifies a byte-budget rejection separately from malformed JSON data. */
export class VehicleJsonByteLimitError extends Error {
	constructor() {
		super("JSON byte ceiling exceeded");
		this.name = "VehicleJsonByteLimitError";
	}
}

/** Copies JSON data under byte, depth and node ceilings, rejecting accessors and non-JSON values. */
export function snapshotVehicleJson(value: unknown, maxBytes: number): JsonValue {
	if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 1_048_576) throw new Error("Invalid JSON byte ceiling");
	let nodes = 0;
	let bytes = 0;
	const ancestors = new Set<object>();
	const encoder = new TextEncoder();
	function charge(text: string): void {
		if (text.length > maxBytes) throw new VehicleJsonByteLimitError();
		bytes += encoder.encode(text).byteLength;
		if (bytes > maxBytes) throw new VehicleJsonByteLimitError();
	}
	function copy(input: unknown, depth: number): JsonValue {
		if (++nodes > 65_536 || depth > 32) throw new Error("JSON structure ceiling exceeded");
		if (input === null || typeof input === "boolean" || (typeof input === "number" && Number.isFinite(input))) {
			charge(JSON.stringify(input));
			return input;
		}
		if (typeof input === "string") {
			if (input.length > maxBytes) throw new VehicleJsonByteLimitError();
			charge(JSON.stringify(input));
			return input;
		}
		if (typeof input !== "object" || input === null || ancestors.has(input)) throw new Error("Expected acyclic JSON data");
		const array = Array.isArray(input);
		const prototype = Object.getPrototypeOf(input);
		if (!array && prototype !== Object.prototype && prototype !== null) throw new Error("Expected plain JSON data");
		ancestors.add(input);
		charge(array ? "[]" : "{}");
		const entries: [string, JsonValue][] = [];
		if (array) {
			if (input.length > 65_536 - nodes) throw new Error("JSON structure ceiling exceeded");
			const result: JsonValue[] = [];
			for (let i = 0; i < input.length; i++) {
				const entry = Object.getOwnPropertyDescriptor(input, String(i));
				if (!entry || !("value" in entry)) throw new Error("Expected JSON array elements");
				if (i) charge(",");
				result.push(copy(entry.value, depth + 1));
			}
			ancestors.delete(input);
			return result;
		}
		for (const key in input) {
			if (!Object.hasOwn(input, key)) continue;
			if (key.length > maxBytes) throw new VehicleJsonByteLimitError();
			charge(`${entries.length ? "," : ""}${JSON.stringify(key)}:`);
			const entry = Object.getOwnPropertyDescriptor(input, key);
			if (!entry || !("value" in entry)) throw new Error("Expected JSON data properties");
			entries.push([key, copy(entry.value, depth + 1)]);
		}
		ancestors.delete(input);
		return Object.fromEntries(entries);
	}
	return copy(value, 0);
}
