import type { VehicleSchemaIssue } from "./codec.js";

/** The `{ success: false, issues }` half of VehicleSchemaResult -- named on its own since every hand-written safeParse's failure branch is this exact shape, never a bare Error. */
export interface VehicleSchemaFailure {
	readonly success: false;
	readonly issues: readonly VehicleSchemaIssue[];
}

/**
 * A safeParse's own first, universal check: the value wasn't even an object. Every hand-written
 * object-shaped VehicleSchemaCodec across the ecosystem re-derived this exact literal before this
 * existed as a shared primitive -- one canonical wording now, not five near-identical copies.
 */
export function notAnObjectIssue(): VehicleSchemaFailure {
	return { success: false, issues: [{ path: [], message: "input must be an object" }] };
}

/**
 * One field-scoped failure. `path` accepts a single key (the common case: a top-level field) or
 * a full path segment array (for a nested/array-indexed field, matching VehicleSchemaIssue.path's
 * own `readonly (string | number)[]` shape directly) -- both real shapes existing hand-written
 * safeParse implementations across the ecosystem already needed.
 */
export function schemaIssue(path: string | number | readonly (string | number)[], message: string): VehicleSchemaFailure {
	return { success: false, issues: [{ path: Array.isArray(path) ? path : [path], message }] };
}

/** True for a real object value -- not null, not an array (JSON Schema's own object/array distinction; `typeof [] === "object"` is not what a caller checking "is this a plain object" means). */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A non-empty string -- the shape every identifier-like field (workspaceId, ref, path, ...) across the ecosystem actually requires; an empty string is a real, distinct failure from "not a string at all". */
export function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.length > 0;
}

/** A real integer safely representable in a double -- the base every bounded-count/size field below builds on. */
export function isSafeInteger(value: unknown): value is number {
	return typeof value === "number" && Number.isSafeInteger(value);
}

/** A safe integer that is zero or more -- e.g. an offset/cursor field where zero is a real, valid value, unlike a positive-only count. */
export function isNonNegativeSafeInteger(value: unknown): value is number {
	return isSafeInteger(value) && value >= 0;
}

/**
 * A safe integer that is at least 1 -- the shape every bounded-count/size field (maxBytes,
 * maxCount, maxResults, maxMatches, ...) across the ecosystem actually requires. `maximum`, when
 * given, additionally caps the accepted value inclusively -- a field that must be positive AND
 * never exceed some hard ceiling (e.g. a page size capped well below an unbounded read) is a real,
 * recurring combination, not a hypothetical one.
 */
export function isPositiveSafeInteger(value: unknown, maximum?: number): value is number {
	return isSafeInteger(value) && value >= 1 && (maximum === undefined || value <= maximum);
}

/** An array whose every element is a string -- the shape every string-list field (labels, tags, pathspecs, ...) across the ecosystem actually requires; a mixed-type array is a real, distinct failure from "not an array at all". */
export function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === "string");
}
