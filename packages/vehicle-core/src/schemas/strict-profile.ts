import { snapshotVehicleJson } from "./bounded-json.js";
import { cloneJson, type JsonSchema, type JsonValue } from "./json.js";

const common = [
	"type",
	"description",
	"title",
	"const",
	"enum",
	"default",
	"examples",
	"readOnly",
	"writeOnly",
	"deprecated",
	"x-vehicle-presentation",
];
const keywords: Record<string, readonly string[]> = {
	string: ["minLength", "maxLength"],
	number: ["minimum", "maximum"],
	integer: ["minimum", "maximum"],
	boolean: [],
	null: [],
	array: ["items", "minItems", "maxItems"],
	object: ["properties", "required", "additionalProperties", "propertyNames", "minProperties", "maxProperties"],
};
function invalid(): never {
	throw new Error("Schema must use the bounded Vehicle JSON Schema profile");
}
function record(value: JsonValue | undefined): JsonSchema {
	if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
	return value as JsonSchema;
}
function range(node: JsonSchema, min: string, max: string, ceiling: number, required: boolean): void {
	const lower = node[min];
	const upper = node[max];
	if (required && upper === undefined) invalid();
	for (const value of [lower, upper])
		if (value !== undefined && (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > ceiling)) invalid();
	if (typeof lower === "number" && typeof upper === "number" && lower > upper) invalid();
}

/** Validates and snapshots a finite, reference-free schema profile; unsupported keywords fail closed. */
export function strictVehicleJsonSchema(value: unknown): JsonSchema {
	const root = record(snapshotVehicleJson(value, 65_536));
	let nodes = 0;
	function visit(node: JsonSchema, depth: number): void {
		if (++nodes > 512 || depth > 16) invalid();
		const union = node["anyOf"] ?? node["oneOf"];
		if (union !== undefined) {
			if (!Array.isArray(union) || union.length < 1 || union.length > 16 || (node["anyOf"] !== undefined && node["oneOf"] !== undefined))
				invalid();
			if (Object.keys(node).some((key) => !["anyOf", "oneOf", "description", "title"].includes(key))) invalid();
			for (const child of union) visit(record(child), depth + 1);
			return;
		}
		const type = node["type"];
		if (typeof type !== "string" || !Object.hasOwn(keywords, type)) invalid();
		const allowed = [...common, ...keywords[type]!];
		if (Object.keys(node).some((key) => !allowed.includes(key))) invalid();
		for (const key of ["title", "description"])
			if (node[key] !== undefined && (typeof node[key] !== "string" || node[key].length > 2048)) invalid();
		for (const key of ["readOnly", "writeOnly", "deprecated"]) if (node[key] !== undefined && typeof node[key] !== "boolean") invalid();
		if (node["x-vehicle-presentation"] !== undefined && !["omit", "summarize", "stream"].includes(String(node["x-vehicle-presentation"])))
			invalid();
		const literals = node["const"] !== undefined ? [node["const"]] : node["enum"];
		for (const candidates of [node["enum"], node["const"] !== undefined ? [node["const"]] : undefined]) {
			if (candidates === undefined) continue;
			if (!Array.isArray(candidates) || candidates.length < 1 || candidates.length > 128) invalid();
			for (const entry of candidates) {
				const matches =
					type === "null"
						? entry === null
						: type === "integer"
							? typeof entry === "number" && Number.isSafeInteger(entry)
							: typeof entry === type && type !== "object";
				if (!matches) invalid();
			}
		}
		switch (type) {
			case "string":
				range(node, "minLength", "maxLength", 65_536, literals === undefined);
				break;
			case "number":
			case "integer": {
				const minimum = node["minimum"];
				const maximum = node["maximum"];
				if (literals === undefined && (typeof minimum !== "number" || typeof maximum !== "number")) invalid();
				for (const bound of [minimum, maximum])
					if (bound !== undefined && (typeof bound !== "number" || !Number.isFinite(bound) || Math.abs(bound) > Number.MAX_SAFE_INTEGER))
						invalid();
				if (typeof minimum === "number" && typeof maximum === "number" && minimum > maximum) invalid();
				break;
			}
			case "array":
				range(node, "minItems", "maxItems", 4096, true);
				visit(record(node["items"]), depth + 1);
				break;
			case "object": {
				const properties = node["properties"] === undefined ? {} : record(node["properties"]);
				const names = Object.keys(properties);
				if (names.length > 128 || names.some((name) => name.length > 256)) invalid();
				const required = node["required"] ?? [];
				if (
					!Array.isArray(required) ||
					required.length > 128 ||
					new Set(required).size !== required.length ||
					required.some((key) => typeof key !== "string" || !Object.hasOwn(properties, key))
				)
					invalid();
				range(node, "minProperties", "maxProperties", 128, node["additionalProperties"] !== false);
				for (const child of Object.values(properties)) visit(record(child), depth + 1);
				if (node["additionalProperties"] !== false) {
					const keySchema = record(node["propertyNames"]);
					if (keySchema["type"] !== "string") invalid();
					visit(keySchema, depth + 1);
					visit(record(node["additionalProperties"]), depth + 1);
				} else if (node["propertyNames"] !== undefined) visit(record(node["propertyNames"]), depth + 1);
				break;
			}
		}
	}
	visit(root, 0);
	return cloneJson(root);
}
