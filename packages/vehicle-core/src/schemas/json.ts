export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export type JsonSchema = Readonly<Record<string, JsonValue>>;

export function cloneJson<T extends JsonValue>(value: T): T {
	const serialized = JSON.stringify(value);
	if (serialized === undefined) throw new Error("Vehicle JSON metadata must be serializable");
	return freezeJson(JSON.parse(serialized) as JsonValue) as T;
}

export function freezeJson(value: JsonValue): JsonValue {
	if (Array.isArray(value)) return Object.freeze(value.map(freezeJson));
	if (value !== null && typeof value === "object") {
		return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, child]) => [key, freezeJson(child)])));
	}
	return value;
}
