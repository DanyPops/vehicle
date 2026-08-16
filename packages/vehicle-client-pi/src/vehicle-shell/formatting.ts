/**
 * Operation formatting + query-matching for the Vehicle Shell's tools_list/tools_man man-page and
 * apropos-style search surface. Split out of vehicle-shell.ts's own bundled concerns.
 */

import type { JsonSchema, VehicleManifestOperation, VehicleOperationDescriptor } from "@danypops/vehicle-core";
import { splitNamespacedName } from "./name-resolution.js";

/** The NAME section of a real man page: one line, no wrapping, safe to list alongside dozens of others. */
export function formatOperationOneLiner(descriptor: VehicleManifestOperation): string {
	const base = `${descriptor.name} -- ${descriptor.description}`;
	if (descriptor.available !== false) return base; // undefined stays unannotated, only a literal false
	return `${base} (currently unavailable${descriptor.unavailableReason ? `: ${descriptor.unavailableReason}` : ""})`;
}

function normalizeShellTerms(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[._\s-]+/g, " ");
}

/** "all" (default): match name OR description, today's exact existing behavior. "name": name-only
 * -- mirrors apropos --names-only ("match only page names, not page descriptions, as with
 * whatis(1)"), tighter and avoids a false positive from an unrelated description merely
 * mentioning the keyword. */
export type ShellQueryScope = "all" | "name";

export function shellQueryScore(descriptor: VehicleOperationDescriptor, query: string, scope: ShellQueryScope = "all"): number | undefined {
	const rawNeedle = query.trim().toLowerCase();
	if (rawNeedle.length === 0) return 0;
	const normalizedNeedle = normalizeShellTerms(query);
	const normalizedName = normalizeShellTerms(descriptor.name);
	const haystack = (scope === "all" ? `${descriptor.name} ${descriptor.description}` : descriptor.name).toLowerCase();
	if (normalizedNeedle.length === 0) {
		return haystack.includes(rawNeedle) ? 3 : undefined;
	}
	if (normalizedName === normalizedNeedle) return 0;
	if (normalizedName.startsWith(normalizedNeedle)) return 1;
	if (normalizedName.includes(normalizedNeedle)) return 2;
	return haystack.includes(rawNeedle) ? 3 : undefined;
}

/**
 * `apropos`'s own default matching mode: query is a regular expression (case-insensitive, matching
 * apropos's own case-insensitivity), tested against the operation's name and description
 * independently -- same "match name OR description" semantics shellQueryScore already has, just a
 * genuinely different match algorithm (substring/prefix vs. a real regex) rather than a different
 * field scope. A name match ranks ahead of a description-only match, mirroring shellQueryScore's
 * own name-before-description ordering; there's no meaningful prefix/substring tier to preserve
 * once the needle is an arbitrary pattern rather than literal text. An empty query matches
 * everything (rank 0), same as shellQueryScore's own empty-query behavior.
 *
 * Deliberately does NOT set RegExp's "g" flag: a global regex's own `.test()` mutates its
 * `lastIndex` across calls, which would silently skip matches on the second and later operations
 * tested against the same compiled instance -- every call here must be independent.
 */
export function compileShellQueryRegex(query: string): RegExp {
	return new RegExp(query, "i");
}

export function regexQueryScore(descriptor: VehicleOperationDescriptor, regex: RegExp, scope: ShellQueryScope = "all"): number | undefined {
	// An empty pattern (new RegExp("")) matches every string for free via .test() -- zero characters
	// are always found at position 0 -- so an empty query already "matches everything" here with no
	// special-casing needed, exactly mirroring shellQueryScore's own empty-query behavior.
	if (regex.test(descriptor.name)) return 0;
	if (scope === "all" && regex.test(descriptor.description)) return 1;
	return undefined;
}

/** Separator-insensitive operation-name matching plus the existing raw description substring match. */
export function matchesShellQuery(descriptor: VehicleOperationDescriptor, query: string): boolean {
	return shellQueryScore(descriptor, query) !== undefined;
}

const MAX_SCHEMA_DEPTH = 5;
const MAX_SCHEMA_LINES = 80;
const MAX_EXAMPLE_LENGTH = 500;

function schemaRecord(value: unknown): Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function schemaDetails(schema: Record<string, unknown>): string {
	const details: string[] = [];
	if (Array.isArray(schema.enum)) details.push(`enum: ${schema.enum.map(String).join(" | ")}`);
	if (schema.default !== undefined) details.push(`default: ${JSON.stringify(schema.default)}`);
	for (const key of ["minimum", "maximum", "minLength", "maxLength", "minItems", "maxItems", "minProperties", "maxProperties"] as const) {
		if (typeof schema[key] === "number") details.push(`${key}: ${schema[key]}`);
	}
	return details.join("; ");
}

function boundedExample(value: unknown): string {
	const serialized = JSON.stringify(value);
	const text = typeof serialized === "string" ? serialized : String(value);
	return text.length <= MAX_EXAMPLE_LENGTH ? text : `${text.slice(0, MAX_EXAMPLE_LENGTH - 1)}…`;
}

function formatSchemaChildren(schema: Record<string, unknown>, indent: string, depth: number, lines: string[]): void {
	if (depth >= MAX_SCHEMA_DEPTH || lines.length >= MAX_SCHEMA_LINES) return;
	const properties = schemaRecord(schema.properties);
	const required = new Set(
		Array.isArray(schema.required) ? schema.required.filter((value): value is string => typeof value === "string") : [],
	);
	for (const [key, raw] of Object.entries(properties)) {
		if (lines.length >= MAX_SCHEMA_LINES) return;
		const property = schemaRecord(raw);
		const type = typeof property.type === "string" ? property.type : "any";
		const marker = required.has(key) ? "required" : "optional";
		const details = schemaDetails(property);
		const description = typeof property.description === "string" ? property.description : "";
		lines.push(`${indent}- ${key} (${type}, ${marker}${details ? `; ${details}` : ""})${description ? `: ${description}` : ""}`);
		formatSchemaChildren(property, `${indent}  `, depth + 1, lines);
	}
	if (schema.items !== undefined) {
		const items = schemaRecord(schema.items);
		const type = typeof items.type === "string" ? items.type : "any";
		const details = schemaDetails(items);
		lines.push(`${indent}items (${type}${details ? `; ${details}` : ""})`);
		formatSchemaChildren(items, `${indent}  `, depth + 1, lines);
	}
	if (typeof schema.additionalProperties === "object" && schema.additionalProperties !== null) {
		const values = schemaRecord(schema.additionalProperties);
		const type = typeof values.type === "string" ? values.type : "any";
		lines.push(`${indent}values (${type})`);
		formatSchemaChildren(values, `${indent}  `, depth + 1, lines);
	}
	// A free-form string-keyed map (e.g. Papyrus's tasks.create checklist) uses patternProperties
	// rather than additionalProperties-as-schema: TypeBox's own Value.Errors() reports the latter
	// only as a generic top-level "must not have additional properties", with no descent into the
	// real nested violation, while patternProperties gives the same per-field precision an array's
	// items already has. Rendered the same way additionalProperties-as-schema was: one "values"
	// line per distinct pattern schema (usually exactly one, a catch-all "^.*$").
	const patternProperties = schemaRecord(schema.patternProperties);
	for (const raw of Object.values(patternProperties)) {
		if (lines.length >= MAX_SCHEMA_LINES) return;
		const values = schemaRecord(raw);
		const type = typeof values.type === "string" ? values.type : "any";
		lines.push(`${indent}values (${type})`);
		formatSchemaChildren(values, `${indent}  `, depth + 1, lines);
	}
	if (Array.isArray(schema.examples)) {
		for (const example of schema.examples.slice(0, 4)) lines.push(`${indent}example: ${boundedExample(example)}`);
	}
}

function formatSchemaProperties(schema: JsonSchema): string[] {
	const lines: string[] = [];
	formatSchemaChildren(schema as Record<string, unknown>, "  ", 0, lines);
	if (lines.length >= MAX_SCHEMA_LINES) lines[MAX_SCHEMA_LINES - 1] = "  … schema documentation truncated";
	return lines.slice(0, MAX_SCHEMA_LINES);
}

/** The full man page for one operation -- description, parameters, and the safety-relevant facts
 * (permissions/effect/idempotency) a model needs before deciding whether and how to call it. */
export function formatOperationManPage(descriptor: VehicleOperationDescriptor, toolName: string, seeAlso: readonly string[] = []): string {
	const lines = [
		`${toolName} (${descriptor.name}, v${descriptor.version})`,
		descriptor.description,
		"",
		`effect: ${descriptor.effect}`,
		`permissions: ${descriptor.permissions.length > 0 ? descriptor.permissions.join(", ") : "none"}`,
		`idempotency: ${descriptor.idempotency.mode}`,
	];
	const properties = formatSchemaProperties(descriptor.inputSchema);
	lines.push("", "parameters:");
	lines.push(...(properties.length > 0 ? properties : ["  (none)"]));
	// Real man pages end with a SEE ALSO section cross-referencing related pages (e.g. printf(3) ->
	// sprintf(3)). Omitted entirely (not an empty "see also:" line) when there's nothing to relate --
	// see relatedOperationNames' own doc comment for what counts as related.
	if (seeAlso.length > 0) lines.push("", `see also: ${seeAlso.join(", ")}`);
	return lines.join("\n");
}

const MAX_SEE_ALSO = 5;

/**
 * Every OTHER operation from the SAME vehicle sharing this operation's own dot-separated namespace
 * prefix (e.g. every other tasks.* operation for tasks.create) -- tools_man's own SEE ALSO section.
 * Bounded to MAX_SEE_ALSO so a vehicle with a huge flat namespace can't dominate the page; a
 * namespace-prefix-free operation name (no "." at all) has nothing to relate it to anything else,
 * by design -- there's no real signal to group it with.
 */
export function relatedOperationNames(
	vehicleName: string,
	operationName: string,
	operations: readonly VehicleManifestOperation[],
): readonly string[] {
	const dot = operationName.indexOf(".");
	if (dot <= 0) return [];
	const prefix = operationName.slice(0, dot + 1);
	const related: string[] = [];
	for (const op of operations) {
		const split = splitNamespacedName(op.name);
		if (!split || split.vehicleName !== vehicleName) continue;
		if (split.operationName === operationName) continue;
		if (!split.operationName.startsWith(prefix)) continue;
		related.push(op.name);
		if (related.length >= MAX_SEE_ALSO) break;
	}
	return related;
}

/**
 * tools_list's own verbosity:"high" line -- the one-liner PLUS its parameter/schema summary,
 * mirroring the terse-vs-full spectrum real `whatis` (terse) vs `man` (full) vs `apropos -l`/
 * `--long` (don't trim) already embody. Deliberately narrower than formatOperationManPage: no
 * effect/permissions/idempotency header, since this is a browsing aid for several operations at
 * once, not a single operation's own full documentation (tools_man already owns that).
 */
export function formatOperationOneLinerVerbose(descriptor: VehicleManifestOperation): string {
	const oneLiner = formatOperationOneLiner(descriptor);
	const properties = formatSchemaProperties(descriptor.inputSchema);
	if (properties.length === 0) return oneLiner;
	return [oneLiner, "  parameters:", ...properties].join("\n");
}
