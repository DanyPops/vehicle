import { extractVehicleContent, isVehicleCredentialFieldName, type JsonValue } from "@danypops/vehicle-core";

export const GENERIC_PRESENTATION_SCHEMA = "vehicle.tool-details/v1" as const;
export const DEFAULT_PRESENTATION_MAX_BYTES = 32 * 1024;
export const GENERIC_PRESENTATION_MAX_ROWS = 50;
export const GENERIC_PRESENTATION_MAX_COLUMNS = 8;
export const GENERIC_PRESENTATION_MAX_FIELD_BYTES = 256;
export const GENERIC_PRESENTATION_MAX_PREVIEW_BYTES = 8 * 1024;

export interface VehiclePresentationCompleteness {
	readonly total: number;
	readonly returned: number;
	readonly omitted: number;
}

export interface VehiclePresentationField {
	readonly label: string;
	readonly value: string;
}

export type GenericVehiclePresentationView =
	| { readonly kind: "empty"; readonly completeness: VehiclePresentationCompleteness }
	| {
			readonly kind: "table";
			readonly columns: readonly string[];
			readonly rows: readonly (readonly string[])[];
			readonly fields: readonly VehiclePresentationField[];
			readonly columnsOmitted: number;
			readonly completeness: VehiclePresentationCompleteness;
	  }
	| {
			readonly kind: "list";
			readonly items: readonly string[];
			readonly fields: readonly VehiclePresentationField[];
			readonly completeness: VehiclePresentationCompleteness;
	  }
	| {
			readonly kind: "fields";
			readonly fields: readonly VehiclePresentationField[];
			readonly completeness: VehiclePresentationCompleteness;
	  }
	| {
			readonly kind: "narrative";
			readonly text: string;
			readonly fields: readonly VehiclePresentationField[];
			readonly completeness: VehiclePresentationCompleteness;
	  }
	| {
			readonly kind: "json";
			readonly preview: string;
			readonly completeness: VehiclePresentationCompleteness;
	  }
	| {
			readonly kind: "progress";
			readonly text: string;
			readonly value?: number;
			readonly max?: number;
			readonly completeness: VehiclePresentationCompleteness;
	  };

export interface GenericVehiclePresentation {
	readonly schema: typeof GENERIC_PRESENTATION_SCHEMA;
	readonly view: GenericVehiclePresentationView;
}

const encoder = new TextEncoder();
// biome-ignore lint/complexity/useRegexLiterals: a constructor avoids control-character lint on the equivalent literal.
const ANSI_PATTERN = new RegExp("\\u001B(?:\\[[0-?]*[ -/]*[@-~]|\\][^\\u0007]*(?:\\u0007|\\u001B\\\\))", "g");

type Primitive = string | number | boolean | null | undefined;

function byteLength(value: string): number {
	return encoder.encode(value).byteLength;
}

function truncateUtf8(value: string, maxBytes: number): string {
	if (maxBytes <= 0) return "";
	if (byteLength(value) <= maxBytes) return value;
	let low = 0;
	let high = value.length;
	while (low < high) {
		const middle = Math.ceil((low + high) / 2);
		if (byteLength(value.slice(0, middle)) <= maxBytes) low = middle;
		else high = middle - 1;
	}
	let end = low;
	if (end > 0) {
		const code = value.charCodeAt(end - 1);
		if (code >= 0xd800 && code <= 0xdbff) end--;
	}
	return value.slice(0, end);
}

function boundedText(value: string, maxBytes = GENERIC_PRESENTATION_MAX_FIELD_BYTES): string {
	const clean = value.replace(ANSI_PATTERN, "");
	if (byteLength(clean) <= maxBytes) return clean;
	const suffix = "…";
	return `${truncateUtf8(clean, Math.max(0, maxBytes - byteLength(suffix)))}${suffix}`;
}

function completeness(total: number, returned: number): VehiclePresentationCompleteness {
	return { total, returned, omitted: Math.max(0, total - returned) };
}

function isPrimitive(value: unknown): value is Primitive {
	return value === null || value === undefined || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function assertJsonSafe(value: unknown, seen = new Set<object>(), path = "$", allowUndefined = false): void {
	if (value === null || typeof value === "string" || typeof value === "boolean") return;
	if (typeof value === "number") {
		if (!Number.isFinite(value)) throw new Error(`Presentation value at ${path} is not a finite JSON number`);
		return;
	}
	if (value === undefined && allowUndefined) return;
	if (typeof value !== "object") throw new Error(`Presentation value at ${path} is not JSON-serializable`);
	if (seen.has(value)) throw new Error(`Presentation value at ${path} is cyclic`);
	seen.add(value);
	if (Array.isArray(value)) {
		for (let index = 0; index < value.length; index++) assertJsonSafe(value[index], seen, `${path}[${index}]`);
	} else {
		const prototype = Object.getPrototypeOf(value);
		if (prototype !== Object.prototype && prototype !== null) throw new Error(`Presentation value at ${path} is not a plain JSON object`);
		for (const [key, child] of Object.entries(value)) assertJsonSafe(child, seen, `${path}.${key}`, allowUndefined);
	}
	seen.delete(value);
}

/** Validates custom projector output without silently dropping functions, undefined values, cycles, or non-finite numbers. */
export function assertJsonSafePresentation(value: unknown, maxBytes: number): asserts value is JsonValue {
	if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error("Presentation maxBytes must be a positive integer");
	assertJsonSafe(value);
	const serialized = JSON.stringify(value);
	if (serialized === undefined) throw new Error("Presentation projector returned a non-JSON value");
	const actualBytes = byteLength(serialized);
	if (actualBytes > maxBytes) throw new Error(`Presentation details exceed maxBytes (actualBytes=${actualBytes}, maxBytes=${maxBytes})`);
}

function safePreview(value: unknown, maxBytes: number): string {
	assertJsonSafe(value, new Set(), "$", true);
	const serialized = JSON.stringify(
		value,
		(key, child) => (key && isVehicleCredentialFieldName(key) ? "[REDACTED]" : child === undefined ? null : child),
		2,
	);
	if (serialized === undefined) throw new Error("Vehicle output is not JSON-serializable");
	return boundedText(serialized, maxBytes);
}

function primitiveText(value: Primitive): string {
	return boundedText(value === null || value === undefined ? "none" : String(value));
}

function visiblePrimitiveFields(entries: readonly [string, Primitive][]): VehiclePresentationField[] {
	return entries.filter(([key]) => !isVehicleCredentialFieldName(key)).map(([key, value]) => ({ label: key, value: primitiveText(value) }));
}

function isContentBlocks(value: unknown): boolean {
	return (
		Array.isArray(value) &&
		value.every((block) => typeof block === "object" && block !== null && (block as { type?: unknown }).type === "text")
	);
}

function singleArrayEnvelope(output: unknown): { items: unknown[]; fields: VehiclePresentationField[] } | undefined {
	if (typeof output !== "object" || output === null || Array.isArray(output)) return undefined;
	const entries = Object.entries(output).filter(([key, value]) => !(key === "content" && isContentBlocks(value)));
	const arrays = entries.filter((entry): entry is [string, unknown[]] => Array.isArray(entry[1]));
	if (arrays.length !== 1 || arrays[0]![1].length === 0) return undefined;
	const [arrayKey, items] = arrays[0]!;
	const siblings = entries.filter(([key]) => key !== arrayKey);
	if (!siblings.every((entry): entry is [string, Primitive] => isPrimitive(entry[1]))) return undefined;
	return { items, fields: visiblePrimitiveFields(siblings) };
}

function objectRows(items: readonly unknown[]): { columns: string[]; rows: string[][]; columnsOmitted: number } | undefined {
	if (!items.every((item) => typeof item === "object" && item !== null && !Array.isArray(item))) return undefined;
	const allColumns: string[] = [];
	for (const item of items) {
		for (const key of Object.keys(item as Record<string, unknown>)) {
			if (key === "content" || isVehicleCredentialFieldName(key) || allColumns.includes(key)) continue;
			allColumns.push(key);
		}
	}
	if (allColumns.length === 0) return undefined;
	const columns = allColumns.slice(0, GENERIC_PRESENTATION_MAX_COLUMNS);
	const rows = items.slice(0, GENERIC_PRESENTATION_MAX_ROWS).map((item) => {
		const record = item as Record<string, unknown>;
		return columns.map((column) => {
			const value = record[column];
			return isPrimitive(value) ? primitiveText(value) : safePreview(value, GENERIC_PRESENTATION_MAX_FIELD_BYTES);
		});
	});
	return { columns, rows, columnsOmitted: allColumns.length - columns.length };
}

function projectArray(items: readonly unknown[], fields: readonly VehiclePresentationField[]): GenericVehiclePresentationView {
	if (items.length === 0) return { kind: "empty", completeness: completeness(0, 0) };
	const table = objectRows(items);
	if (table) {
		return {
			kind: "table",
			columns: table.columns,
			rows: table.rows,
			fields: [...fields],
			columnsOmitted: table.columnsOmitted,
			completeness: completeness(items.length, table.rows.length),
		};
	}
	if (items.every((item): item is string => typeof item === "string")) {
		const projected = items.slice(0, GENERIC_PRESENTATION_MAX_ROWS).map((item) => boundedText(item));
		return { kind: "list", items: projected, fields: [...fields], completeness: completeness(items.length, projected.length) };
	}
	const fullPreview = safePreview(items, Number.MAX_SAFE_INTEGER);
	const preview = boundedText(fullPreview, GENERIC_PRESENTATION_MAX_PREVIEW_BYTES);
	return { kind: "json", preview, completeness: completeness(byteLength(fullPreview), byteLength(preview)) };
}

function fitToSerializedBound(presentation: GenericVehiclePresentation, maxBytes: number): GenericVehiclePresentation {
	const mutable = structuredClone(presentation) as GenericVehiclePresentation;
	for (;;) {
		const serialized = JSON.stringify(mutable);
		if (byteLength(serialized) <= maxBytes) return mutable;
		const view = mutable.view;
		if (view.kind === "table" && view.rows.length > 0) {
			(view.rows as string[][]).pop();
			(view as { completeness: VehiclePresentationCompleteness }).completeness = completeness(view.completeness.total, view.rows.length);
			continue;
		}
		if (view.kind === "list" && view.items.length > 0) {
			(view.items as string[]).pop();
			(view as { completeness: VehiclePresentationCompleteness }).completeness = completeness(view.completeness.total, view.items.length);
			continue;
		}
		if ((view.kind === "fields" || view.kind === "narrative") && view.fields.length > 0) {
			(view.fields as VehiclePresentationField[]).pop();
			(view as { completeness: VehiclePresentationCompleteness }).completeness = completeness(view.completeness.total, view.fields.length);
			continue;
		}
		if (view.kind === "json" && view.preview.length > 0) {
			(view as { preview: string }).preview = boundedText(view.preview, Math.floor(byteLength(view.preview) / 2));
			continue;
		}
		if (view.kind === "narrative" && view.text.length > 0) {
			(view as { text: string }).text = boundedText(view.text, Math.floor(byteLength(view.text) / 2));
			continue;
		}
		throw new Error(`Generic presentation cannot fit maxBytes=${maxBytes}`);
	}
}

/** Materializes the bounded, replay-stable generic human-presentation DTO once, before Pi persists details. */
export function projectGenericVehiclePresentation(output: unknown, maxBytes = DEFAULT_PRESENTATION_MAX_BYTES): GenericVehiclePresentation {
	let view: GenericVehiclePresentationView;
	if (Array.isArray(output)) {
		view = projectArray(output, []);
	} else {
		const envelope = singleArrayEnvelope(output);
		if (envelope) {
			view = projectArray(envelope.items, envelope.fields);
		} else {
			const content = extractVehicleContent(output);
			const entries = typeof output === "object" && output !== null ? Object.entries(output).filter(([key]) => key !== "content") : [];
			if (content && entries.every((entry): entry is [string, Primitive] => isPrimitive(entry[1]))) {
				const text = boundedText(content.map((block) => block.text).join("\n"), GENERIC_PRESENTATION_MAX_PREVIEW_BYTES);
				const fields = visiblePrimitiveFields(entries);
				view = { kind: "narrative", text, fields, completeness: completeness(fields.length, fields.length) };
			} else if (entries.length > 0 && entries.every((entry): entry is [string, Primitive] => isPrimitive(entry[1]))) {
				const fields = visiblePrimitiveFields(entries);
				view = { kind: "fields", fields, completeness: completeness(entries.length, fields.length) };
			} else {
				const fullPreview = safePreview(output, Number.MAX_SAFE_INTEGER);
				const preview = boundedText(fullPreview, GENERIC_PRESENTATION_MAX_PREVIEW_BYTES);
				view = { kind: "json", preview, completeness: completeness(byteLength(fullPreview), byteLength(preview)) };
			}
		}
	}
	const presentation = fitToSerializedBound({ schema: GENERIC_PRESENTATION_SCHEMA, view }, maxBytes);
	assertJsonSafePresentation(presentation, maxBytes);
	return presentation;
}

export function projectGenericVehicleProgress(progress: unknown, maxBytes = DEFAULT_PRESENTATION_MAX_BYTES): GenericVehiclePresentation {
	let value: number | undefined;
	let max: number | undefined;
	if (typeof progress === "object" && progress !== null && !Array.isArray(progress)) {
		const record = progress as Record<string, unknown>;
		value = typeof record.current === "number" ? record.current : typeof record.value === "number" ? record.value : undefined;
		max = typeof record.total === "number" ? record.total : typeof record.max === "number" ? record.max : undefined;
	}
	const text = typeof progress === "string" ? boundedText(progress) : safePreview(progress, GENERIC_PRESENTATION_MAX_FIELD_BYTES);
	const presentation: GenericVehiclePresentation = {
		schema: GENERIC_PRESENTATION_SCHEMA,
		view: {
			kind: "progress",
			text,
			...(value === undefined ? {} : { value }),
			...(max === undefined ? {} : { max }),
			completeness: completeness(1, 1),
		},
	};
	assertJsonSafePresentation(presentation, maxBytes);
	return presentation;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
	const expected = [...keys].sort();
	return Object.keys(value)
		.sort()
		.every((key, index, actual) => key === expected[index] && actual.length === expected.length);
}

function validCompleteness(value: unknown): value is VehiclePresentationCompleteness {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const record = value as Record<string, unknown>;
	return (
		exactKeys(record, ["total", "returned", "omitted"]) &&
		[record.total, record.returned, record.omitted].every((part) => Number.isSafeInteger(part) && (part as number) >= 0) &&
		record.total === (record.returned as number) + (record.omitted as number)
	);
}

function validFields(value: unknown): value is readonly VehiclePresentationField[] {
	return (
		Array.isArray(value) &&
		value.length <= GENERIC_PRESENTATION_MAX_ROWS &&
		value.every(
			(field) =>
				typeof field === "object" &&
				field !== null &&
				!Array.isArray(field) &&
				exactKeys(field as Record<string, unknown>, ["label", "value"]) &&
				typeof (field as VehiclePresentationField).label === "string" &&
				typeof (field as VehiclePresentationField).value === "string" &&
				byteLength((field as VehiclePresentationField).value) <= GENERIC_PRESENTATION_MAX_FIELD_BYTES,
		)
	);
}

/** Strict, fail-closed replay parser. Unknown versions and malformed/oversized/cyclic values return undefined. */
export function parseGenericVehiclePresentation(
	value: unknown,
	maxBytes = DEFAULT_PRESENTATION_MAX_BYTES,
): GenericVehiclePresentation | undefined {
	try {
		assertJsonSafePresentation(value, maxBytes);
		if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
		const root = value as Record<string, unknown>;
		if (!exactKeys(root, ["schema", "view"]) || root.schema !== GENERIC_PRESENTATION_SCHEMA) return undefined;
		if (typeof root.view !== "object" || root.view === null || Array.isArray(root.view)) return undefined;
		const view = root.view as Record<string, unknown>;
		if (typeof view.kind !== "string" || !validCompleteness(view.completeness)) return undefined;
		switch (view.kind) {
			case "empty":
				if (!exactKeys(view, ["kind", "completeness"])) return undefined;
				break;
			case "fields":
				if (!exactKeys(view, ["kind", "fields", "completeness"]) || !validFields(view.fields)) return undefined;
				break;
			case "list":
				if (!exactKeys(view, ["kind", "items", "fields", "completeness"]) || !validFields(view.fields)) return undefined;
				if (
					!Array.isArray(view.items) ||
					view.items.length > GENERIC_PRESENTATION_MAX_ROWS ||
					!view.items.every((item) => typeof item === "string" && byteLength(item) <= GENERIC_PRESENTATION_MAX_FIELD_BYTES)
				)
					return undefined;
				break;
			case "table": {
				if (!exactKeys(view, ["kind", "columns", "rows", "fields", "columnsOmitted", "completeness"]) || !validFields(view.fields))
					return undefined;
				if (
					!Array.isArray(view.columns) ||
					view.columns.length > GENERIC_PRESENTATION_MAX_COLUMNS ||
					!view.columns.every((column) => typeof column === "string")
				)
					return undefined;
				if (
					!Array.isArray(view.rows) ||
					view.rows.length > GENERIC_PRESENTATION_MAX_ROWS ||
					!view.rows.every(
						(row) =>
							Array.isArray(row) &&
							row.length === (view.columns as unknown[]).length &&
							row.every((cell) => typeof cell === "string" && byteLength(cell) <= GENERIC_PRESENTATION_MAX_FIELD_BYTES),
					)
				)
					return undefined;
				if (!Number.isSafeInteger(view.columnsOmitted) || (view.columnsOmitted as number) < 0) return undefined;
				break;
			}
			case "narrative":
				if (
					!exactKeys(view, ["kind", "text", "fields", "completeness"]) ||
					typeof view.text !== "string" ||
					byteLength(view.text) > GENERIC_PRESENTATION_MAX_PREVIEW_BYTES ||
					!validFields(view.fields)
				)
					return undefined;
				break;
			case "json":
				if (
					!exactKeys(view, ["kind", "preview", "completeness"]) ||
					typeof view.preview !== "string" ||
					byteLength(view.preview) > GENERIC_PRESENTATION_MAX_PREVIEW_BYTES
				)
					return undefined;
				break;
			case "progress":
				if (
					!Object.keys(view).every((key) => ["kind", "text", "value", "max", "completeness"].includes(key)) ||
					typeof view.text !== "string"
				)
					return undefined;
				if (view.value !== undefined && (typeof view.value !== "number" || !Number.isFinite(view.value))) return undefined;
				if (view.max !== undefined && (typeof view.max !== "number" || !Number.isFinite(view.max))) return undefined;
				break;
			default:
				return undefined;
		}
		return value as unknown as GenericVehiclePresentation;
	} catch {
		return undefined;
	}
}
