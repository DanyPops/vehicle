import {
	extractVehicleContent,
	isVehicleCredentialFieldName,
	type JsonSchema,
	VEHICLE_SCHEMA_PRESENTATION_EXTENSION,
	type VehicleEffect,
	type VehicleOperationDescriptor,
} from "@danypops/vehicle-core";
import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { Theme, ThemeColor, ToolDefinition, ToolRenderResultOptions } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import { truncateToWidth as truncateToWidthUnsafe, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import {
	buildDetailLines,
	CollapsibleText,
	type DetailField,
	type DetailViewTheme,
	deriveTableColumns,
	firstDistinctStyle,
	neutralizeEmbeddedFullResets,
	ProgressBar,
	type ProgressBarGlyphStyle,
	type ProgressBarGlyphs,
	renderBoundedTable,
	renderTruncatedList,
	statelessComponent,
	Text,
	type TextMeasure,
} from "malevich-tui-components";
import { expandHint } from "./expand-hint.js";
import { type GenericVehiclePresentation, parseGenericVehiclePresentation, type VehiclePresentationField } from "./vehicle-render-model.js";

// ToolRenderContext itself isn't part of the public export barrel; derive
// its shape from the exported ToolDefinition so this stays in sync with
// whatever Pi actually passes, instead of hand-duplicating the interface.
type RenderCallContext = Parameters<NonNullable<ToolDefinition["renderCall"]>>[2];
type RenderResultContext = Parameters<NonNullable<ToolDefinition["renderResult"]>>[3];

/**
 * Generic default rendering for any Vehicle-projected Pi tool, driven by the
 * operation's own descriptor metadata (effect, name) rather than requiring
 * every operation to hand-roll renderCall/renderResult. A consumer with real
 * UX investment in one operation still supplies its own pair through
 * RegisterVehicleToolsOptions.renderers -- this is the fallback, not the
 * only option.
 */

/**
 * Re-exported for existing consumers of this module's own subpath (`@danypops/vehicle-client-pi/
 * vehicle-render`) -- this used to be this function's origin, but it fixes a real host
 * `truncateToWidth` behavior, not a Vehicle-specific concern, and Malevich (already a shared
 * dependency of every affected package) is the more honest home for it now. See its own doc
 * comment there for the full diagnosis.
 */
export { neutralizeEmbeddedFullResets };

function truncateToWidth(text: string, maxWidth: number, ellipsis?: string, pad?: boolean): string {
	return neutralizeEmbeddedFullResets(truncateToWidthUnsafe(text, maxWidth, ellipsis, pad));
}

const measure: TextMeasure = { visibleWidth, truncateToWidth, wrapTextWithAnsi };

/** Preference-ordered theme tokens per effect, most specific first -- cascaded through firstDistinctStyle since not every Pi theme defines all of these distinctly from plain text. */
const EFFECT_TOKENS: Record<VehicleEffect, readonly ThemeColor[]> = {
	read: ["muted", "dim"],
	"local-write": ["text"],
	"external-write": ["warning"],
	destructive: ["error"],
	"open-world": ["error"],
};

/** Absolute last-resort ANSI codes, used only when a theme fails to distinguish even its own error/warning tokens from plain text. */
const HARDCODED_FALLBACK: Record<VehicleEffect, string> = {
	read: "\x1b[90m", // bright black
	"local-write": "",
	"external-write": "\x1b[33m", // yellow
	destructive: "\x1b[31m", // red
	"open-world": "\x1b[31m",
};

function effectStyle(theme: Theme, effect: VehicleEffect, text: string): string {
	const baseline = theme.fg("text", text);
	const candidates = EFFECT_TOKENS[effect].map((token) => theme.fg(token, text));
	const fallbackCode = HARDCODED_FALLBACK[effect];
	const fallback = fallbackCode ? `${fallbackCode}${text}\x1b[39m` : text;
	return firstDistinctStyle(baseline, candidates, fallback);
}

/** Collapses embedded newlines (and their surrounding whitespace) into a single space -- a call's
 * one-line args summary has no per-physical-line contract to split into (unlike withTrailingLine's
 * result-side siblings below); a multi-paragraph value like tasks.create's body must stay one
 * line, not leak extra orphaned lines into the Text component that renders this string. */
function collapseToSingleLine(text: string): string {
	return text.replace(/\s*\n+\s*/g, " ").trim();
}

/** A scalar value renders as itself; anything structured (array/object) falls back to compact JSON just for that one value, never for the whole args bag. */
function formatArgValue(value: unknown): string {
	if (typeof value === "string") return collapseToSingleLine(value);
	if (typeof value === "number" || typeof value === "boolean" || value === null) return String(value);
	return JSON.stringify(value) ?? String(value);
}

/** Generic identity-ish argument key names, priority order. A domain with richer
 * semantics passes its own list to pickIdentityArgument instead. */
const DEFAULT_IDENTITY_ARG_KEYS = ["name", "title", "id", "text", "query", "url"] as const;

/** First present, non-empty string value from a priority-ordered key list. Exported so a
 * domain's own renderCall can reuse this instead of hand-rolling the same lookup. */
export function pickIdentityArgument(args: unknown, priorityKeys: readonly string[], maxLength = 80): string | undefined {
	if (typeof args !== "object" || args === null || Array.isArray(args)) return undefined;
	const record = args as Record<string, unknown>;
	for (const key of priorityKeys) {
		const value = record[key];
		if (typeof value === "string" && value.trim()) return value.trim().slice(0, maxLength);
	}
	return undefined;
}

/** Drops any arg whose value equals cwd -- e.g. a project_root identical to the session's
 * own working directory is noise once shown. */
function dropCwdRedundantArgs(args: Record<string, unknown>, cwd: string | undefined): Record<string, unknown> {
	if (cwd === undefined) return args;
	return Object.fromEntries(Object.entries(args).filter(([, value]) => value !== cwd));
}

interface ArgsDisplay {
	/** One recognized identity value (see DEFAULT_IDENTITY_ARG_KEYS), styled distinctly from `rest`. */
	readonly identity?: string;
	/** Remaining args as `key=value key2=value2`; omits undefined values and whichever key became `identity`. */
	readonly rest?: string;
}

type SchemaNode = Readonly<Record<string, unknown>>;

function propertySchema(schema: SchemaNode | undefined, key: string): SchemaNode | undefined {
	const properties = schema?.properties;
	if (typeof properties !== "object" || properties === null || Array.isArray(properties)) return undefined;
	const child = (properties as Record<string, unknown>)[key];
	return typeof child === "object" && child !== null && !Array.isArray(child) ? (child as SchemaNode) : undefined;
}

function presentationMode(schema: SchemaNode | undefined): "omit" | "summarize" | undefined {
	const mode = schema?.[VEHICLE_SCHEMA_PRESENTATION_EXTENSION];
	return mode === "omit" || mode === "summarize" ? mode : undefined;
}

function isSensitiveSchema(key: string, schema: SchemaNode | undefined): boolean {
	return (
		isVehicleCredentialFieldName(key) || schema?.writeOnly === true || schema?.format === "password" || presentationMode(schema) === "omit"
	);
}

function summarizedValue(value: unknown): string {
	if (Array.isArray(value)) return `[${value.length} item${value.length === 1 ? "" : "s"}]`;
	if (typeof value === "object" && value !== null)
		return `{${Object.keys(value).length} field${Object.keys(value).length === 1 ? "" : "s"}}`;
	if (typeof value === "string") return `<${value.length} chars>`;
	return `<${typeof value}>`;
}

function sanitizeCallValue(value: unknown, schema: SchemaNode | undefined): unknown {
	if (presentationMode(schema) === "summarize") return summarizedValue(value);
	if (Array.isArray(value)) {
		const itemSchema =
			typeof schema?.items === "object" && schema.items !== null && !Array.isArray(schema.items) ? (schema.items as SchemaNode) : undefined;
		return value.map((item) => sanitizeCallValue(item, itemSchema));
	}
	if (typeof value !== "object" || value === null) return value;
	return Object.fromEntries(
		Object.entries(value as Record<string, unknown>)
			.filter(([key]) => !isSensitiveSchema(key, propertySchema(schema, key)))
			.map(([key, child]) => [key, sanitizeCallValue(child, propertySchema(schema, key))]),
	);
}

function splitArgsForDisplay(args: unknown, cwd: string | undefined, width: number, inputSchema: JsonSchema): ArgsDisplay {
	if (args === undefined || args === null) return {};
	if (typeof args !== "object" || Array.isArray(args)) {
		const text = truncateToWidth(formatArgValue(sanitizeCallValue(args, inputSchema)), width);
		return text ? { rest: text } : {};
	}
	const schema = inputSchema as SchemaNode;
	const sanitized = Object.fromEntries(
		Object.entries(args as Record<string, unknown>)
			.filter(([key]) => !isSensitiveSchema(key, propertySchema(schema, key)))
			.map(([key, value]) => [key, sanitizeCallValue(value, propertySchema(schema, key))]),
	);
	const visible = dropCwdRedundantArgs(sanitized, cwd);
	const identityKey = DEFAULT_IDENTITY_ARG_KEYS.find((key) => typeof visible[key] === "string" && (visible[key] as string).trim());
	const pairs = Object.entries(visible)
		.filter(([key, value]) => value !== undefined && key !== identityKey)
		.map(([key, value]) => `${key}=${formatArgValue(value)}`);
	return {
		identity: identityKey ? truncateToWidth(formatArgValue(visible[identityKey]), width) : undefined,
		rest: pairs.length ? truncateToWidth(pairs.join(" "), width) : undefined,
	};
}

/** "tasks.cancel_subtree" -> "Tasks Cancel Subtree": a mechanical, domain-agnostic
 * transform (split on "." and "_", title-case each word), not a lookup table -- works
 * the same for any "domain.action" operation name regardless of which Vehicle it's from. */
export function humanizeOperationName(name: string): string {
	return name
		.split(".")
		.map((segment) =>
			segment
				.split("_")
				.map((word) => (word ? word[0]!.toUpperCase() + word.slice(1) : word))
				.join(" "),
		)
		.join(" ");
}

export function renderVehicleCall(
	descriptor: VehicleOperationDescriptor,
	args: unknown,
	theme: Theme,
	context: RenderCallContext,
): Component {
	const { identity, rest } = splitArgsForDisplay(args, context.cwd, 60, descriptor.inputSchema);
	const segments = [
		theme.bold(humanizeOperationName(descriptor.name)),
		...(identity ? [theme.fg("accent", identity)] : []),
		...(rest ? [theme.fg("dim", rest)] : []),
	];
	return new Text({ text: effectStyle(theme, descriptor.effect, segments.join(" ")), measure });
}

/** Rows beyond this default render as a truncation note (via Malevich's renderBoundedTable) instead of an ever-taller table -- a generic renderer has no schema-level sense of "how much of this array actually matters," so it borrows the same order-of-magnitude default several of Lector's own list renderers use (files/matches). Resolved here, at the Vehicle client, from Pi's own tool-row `expanded` flag -- the identical mechanism Lector's own renderers already key off, not a second, Vehicle-specific toggle. */
const DEFAULT_VISIBLE_ROWS = 20;

function moreRowsLine(theme: Theme, hiddenCount: number): string {
	return theme.fg("dim", `... ${hiddenCount} more row${hiddenCount === 1 ? "" : "s"} (${expandHint("to expand")})`);
}

/** Best-effort duck-typing over an untyped Vehicle progress payload: {current,total} or {value,max} render as a bar, anything else falls back to a plain line. */
function progressBarFor(progress: unknown, theme: Theme, glyphs?: ProgressBarGlyphs | ProgressBarGlyphStyle): Component {
	if (progress && typeof progress === "object") {
		const p = progress as Record<string, unknown>;
		const value = typeof p.current === "number" ? p.current : typeof p.value === "number" ? p.value : undefined;
		const max = typeof p.total === "number" ? p.total : typeof p.max === "number" ? p.max : undefined;
		if (value !== undefined) {
			return new ProgressBar({ value, max: max ?? 100, glyphs, style: (s) => theme.fg("accent", s), measure });
		}
	}
	const text = typeof progress === "string" ? progress : JSON.stringify(progress);
	return new Text({ text: theme.fg("dim", text ?? ""), measure });
}

type Primitive = string | number | boolean | null | undefined;

function isPrimitive(value: unknown): value is Primitive {
	return value === null || value === undefined || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

/**
 * A common REST/RPC pagination shape: one dominant array field plus a few
 * scalar siblings (a cursor, a count) -- e.g. {events, nextCursor}. Only
 * fires for exactly one non-empty array field with every sibling a
 * primitive; anything else (multiple array fields, a non-primitive
 * sibling) is ambiguous enough to leave alone rather than guess.
 */
/** A VehicleContentBlock[] sibling is Vehicle's own protocol field for the LLM's
 * transcript text (see vehicle-core's WithVehicleContent), never domain payload --
 * excluded up front so it can't count as a second array or fail the primitive-sibling check. */
function isVehicleContentBlockArray(value: unknown): boolean {
	return (
		Array.isArray(value) &&
		value.every((block) => typeof block === "object" && block !== null && (block as { type?: unknown }).type === "text")
	);
}

function singleArrayEnvelope(output: unknown): { items: unknown[]; siblings: [string, Primitive][] } | undefined {
	if (typeof output !== "object" || output === null || Array.isArray(output)) return undefined;
	const entries = Object.entries(output as Record<string, unknown>).filter(
		([key, value]) => !(key === "content" && isVehicleContentBlockArray(value)),
	);
	const arrayEntries = entries.filter((entry): entry is [string, unknown[]] => Array.isArray(entry[1]));
	if (arrayEntries.length !== 1) return undefined;
	const [arrayKey, items] = arrayEntries[0] as [string, unknown[]];
	if (items.length === 0) return undefined;
	const siblings = entries.filter(([key]) => key !== arrayKey);
	if (!siblings.every((entry): entry is [string, Primitive] => isPrimitive(entry[1]))) return undefined;
	return { items, siblings };
}

/**
 * Two or more array fields -- e.g. tasks.graph's TaskGraph ({nodes, rootIds}) or
 * tasks.cancel_subtree's {canceled, skipped}. singleArrayEnvelope only ever unwraps exactly
 * one array field, deliberately, to avoid GUESSING which one is the real payload when there's
 * ambiguity. This isn't guessing -- it shows every array, each in its own labeled section, so
 * there's nothing to pick wrong. Requires at least one array to be non-empty (an object whose
 * only arrays are all empty gets no benefit from this over the record/JSON fallback) and every
 * non-array sibling to be primitive, same discipline as singleArrayEnvelope.
 */
function multiArrayEnvelope(output: unknown): { arrays: [string, unknown[]][]; siblings: [string, Primitive][] } | undefined {
	if (typeof output !== "object" || output === null || Array.isArray(output)) return undefined;
	const entries = Object.entries(output as Record<string, unknown>).filter(
		([key, value]) => !(key === "content" && isVehicleContentBlockArray(value)),
	);
	const arrayEntries = entries.filter((entry): entry is [string, unknown[]] => Array.isArray(entry[1]));
	if (arrayEntries.length < 2 || !arrayEntries.some(([, items]) => items.length > 0)) return undefined;
	const arrayKeys = new Set(arrayEntries.map(([key]) => key));
	const siblings = entries.filter(([key]) => !arrayKeys.has(key));
	if (!siblings.every((entry): entry is [string, Primitive] => isPrimitive(entry[1]))) return undefined;
	return { arrays: arrayEntries, siblings };
}

/**
 * The envelope singleArrayEnvelope's own content exclusion leaves behind: no domain array at all,
 * just a real content: VehicleContentBlock[] (Vehicle's own model-facing narration channel --
 * extractVehicleContent already reads this exact shape for the LLM side) plus primitive siblings
 * -- e.g. discuss.block/unblock's {blocked, content}. Rather than dumping raw JSON when there's
 * nothing to tabulate, show the narration text plainly, the same text the model itself sees.
 * Same ambiguity discipline as singleArrayEnvelope: a non-primitive sibling still falls through
 * to raw JSON rather than guessing.
 */
function plainContentEnvelope(output: unknown): { text: string; siblings: [string, Primitive][] } | undefined {
	const blocks = extractVehicleContent(output);
	if (!blocks || blocks.length === 0) return undefined;
	const siblings = Object.entries(output as Record<string, unknown>).filter(([key]) => key !== "content");
	if (!siblings.every((entry): entry is [string, Primitive] => isPrimitive(entry[1]))) return undefined;
	return { text: blocks.map((block) => block.text).join("\n"), siblings };
}

function formatSiblingLine(siblings: readonly [string, Primitive][]): string {
	return siblings.map(([key, value]) => `${key}: ${value === null || value === undefined ? "none" : String(value)}`).join(" · ");
}

/** "taskId" -> "Task Id", "lease_expires_at" -> "Lease Expires At" -- the same mechanical,
 * domain-agnostic transform as humanizeOperationName, applied to a flat record's own field
 * names instead of an operation name. */
function humanizeFieldKey(key: string): string {
	return key
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/_/g, " ")
		.split(" ")
		.filter(Boolean)
		.map((word) => word[0]!.toUpperCase() + word.slice(1))
		.join(" ");
}

/**
 * A plain object with at least one primitive-scalar field -- e.g. tasks.claim's TaskLease
 * (every field primitive) or tasks.mutation_status's TaskMutationReceiptView (8 primitive
 * fields plus one genuinely nested `result`). Neither singleArrayEnvelope, multiArrayEnvelope,
 * nor plainContentEnvelope cover this: all three require at least one array/content-block
 * field. Previously required EVERY field to be primitive (all-or-nothing), so a record with
 * even one nested field got zero credit for the rest and fell straight to raw JSON -- the
 * majority case for every operation that also carries some structured payload alongside its
 * own scalar metadata. Now: primitive fields render as labeled key/value pairs as before, and
 * any remaining nested field renders as its own labeled JSON block underneath, rather than
 * discarding the whole render. undefined for an empty object or one with ZERO primitive
 * fields (nothing to salvage) -- that genuinely stays on the raw-JSON fallback, since a purely
 * structured shape gets no benefit from this over the plain dump.
 */
function recordEnvelope(output: unknown): { fields: DetailField[]; nested: [string, unknown][] } | undefined {
	if (typeof output !== "object" || output === null || Array.isArray(output)) return undefined;
	const entries = Object.entries(output as Record<string, unknown>);
	if (entries.length === 0) return undefined;
	const primitiveEntries = entries.filter((entry): entry is [string, Primitive] => isPrimitive(entry[1]));
	if (primitiveEntries.length === 0) return undefined;
	const nested = entries.filter((entry): entry is [string, unknown] => !isPrimitive(entry[1]));
	return {
		fields: primitiveEntries.map(([key, value]) => ({
			label: humanizeFieldKey(key),
			value: value === null || value === undefined ? "none" : String(value),
		})),
		nested,
	};
}

function flatRecordTheme(theme: Theme): DetailViewTheme {
	return {
		field: (s) => theme.fg("text", s),
		heading: (s) => theme.fg("toolTitle", theme.bold(s)),
		byline: (s) => theme.fg("dim", s),
		body: (s) => theme.fg("text", s),
	};
}

/**
 * Appends one or more (each already width-safe on its own render pass) lines after an inner
 * component's own output -- used to attach an envelope's sibling-field annotation without
 * disturbing the inner component's own rendering. Splits on embedded newlines first: a
 * sibling value that is itself a real multi-paragraph string (not just a short cursor/count)
 * still carries literal \n characters after formatSiblingLine joins it in -- appending that
 * as ONE array entry violates the one-array-entry-per-physical-terminal-line contract every
 * Component.render() consumer depends on (Table's own singleLine() guards the identical
 * hazard for its cells). A real terminal splits the embedded newline into its own row
 * regardless of how many array entries we thought we returned; only the LAST resulting
 * fragment would ever receive the outer Box's own full-width padding, leaving every earlier
 * physical line's background painted only as wide as its own text.
 */
function withTrailingLine(inner: Component, line: string): Component {
	const lines = line.split("\n");
	return {
		render: (width: number) => [...inner.render(width), ...lines.map((l) => truncateToWidth(l, width))],
		invalidate: () => inner.invalidate(),
	};
}

/** Renders an array the same way regardless of whether it arrived as the
 * top-level output or was unwrapped from a single-array envelope --
 * undefined when the array shape itself isn't one this renderer curates
 * (e.g. an array of numbers), signaling the caller to fall back to raw JSON. */
function renderArrayOutput(items: readonly unknown[], options: ToolRenderResultOptions, theme: Theme): Component | undefined {
	if (items.length === 0) return new Text({ text: theme.fg("dim", "No results."), measure });
	const table = deriveTableColumns(items);
	if (table) {
		return renderBoundedTable({
			...table,
			expanded: options.expanded,
			visibleRowCount: DEFAULT_VISIBLE_ROWS,
			moreLine: (hiddenCount) => moreRowsLine(theme, hiddenCount),
			headerStyle: (s) => theme.fg("muted", theme.bold(s)),
			measure,
		});
	}
	// deriveTableColumns only handles arrays of objects, returning undefined
	// for an array of plain strings (e.g. discuss.list's formatted summary
	// lines) -- without this, that shape fell through to a raw JSON.stringify
	// dump (quotes, brackets, commas, no color). Reuses the same bounded-list
	// primitive and "... N more" wording the table path already uses.
	if (items.every((item): item is string => typeof item === "string")) {
		const lines = renderTruncatedList({
			items,
			expanded: options.expanded,
			visibleCount: DEFAULT_VISIBLE_ROWS,
			formatItem: (item) => theme.fg("text", item),
			moreLine: (hiddenCount) => moreRowsLine(theme, hiddenCount),
		});
		return new Text({ text: lines.join("\n"), measure });
	}
	return undefined;
}

function renderedFields(fields: readonly VehiclePresentationField[], theme: Theme): Component {
	const detailFields: DetailField[] = fields.map((field) => ({ label: humanizeFieldKey(field.label), value: field.value }));
	const fieldTheme = flatRecordTheme(theme);
	return statelessComponent((width) =>
		buildDetailLines(Math.max(1, width), { fields: detailFields, alignFields: true, theme: fieldTheme, measure }),
	);
}

/** A nested (non-primitive) field's own labeled JSON block -- recordEnvelope's fallback for
 * whatever isn't a primitive field, rather than discarding it or reverting the whole render to
 * raw JSON. */
function renderNestedFieldLines(key: string, value: unknown, theme: Theme, width: number): string[] {
	const heading = theme.fg("toolTitle", theme.bold(`${humanizeFieldKey(key)}:`));
	const json = JSON.stringify(value, null, 2) ?? String(value);
	return [heading, ...json.split("\n").map((line) => truncateToWidth(theme.fg("dim", line), width))];
}

function renderRecordEnvelope(envelope: { fields: DetailField[]; nested: [string, unknown][] }, theme: Theme): Component {
	const fieldsComponent = renderedFields(
		envelope.fields.map((field) => ({ label: field.label, value: String(field.value) })),
		theme,
	);
	if (envelope.nested.length === 0) return fieldsComponent;
	return {
		render: (width: number) => [
			...fieldsComponent.render(width),
			...envelope.nested.flatMap(([key, value]) => renderNestedFieldLines(key, value, theme, width)),
		],
		invalidate: () => fieldsComponent.invalidate(),
	};
}

/**
 * Every array field as its own labeled section, in declaration order, plus a trailing sibling
 * line for any remaining primitive fields. undefined (falls back to the raw-JSON/record path)
 * if any array's own shape isn't one renderArrayOutput curates (e.g. an array of numbers) --
 * a half-curated, half-JSON result would be more confusing than a consistent single fallback.
 */
function renderMultiArrayEnvelope(
	envelope: { arrays: [string, unknown[]][]; siblings: [string, Primitive][] },
	options: ToolRenderResultOptions,
	theme: Theme,
): Component | undefined {
	const sections: { heading: string; component: Component }[] = [];
	for (const [key, items] of envelope.arrays) {
		const component = renderArrayOutput(items, options, theme);
		if (!component) return undefined;
		sections.push({ heading: theme.fg("toolTitle", theme.bold(`${humanizeFieldKey(key)}:`)), component });
	}
	return {
		render: (width: number) => {
			const lines: string[] = [];
			for (const section of sections) {
				lines.push(section.heading);
				lines.push(...section.component.render(width));
			}
			if (envelope.siblings.length > 0) lines.push(truncateToWidth(theme.fg("dim", formatSiblingLine(envelope.siblings)), width));
			return lines;
		},
		invalidate: () => {
			for (const section of sections) section.component.invalidate();
		},
	};
}

function appendPresentationAnnotations(
	inner: Component,
	fields: readonly VehiclePresentationField[],
	omitted: number,
	theme: Theme,
): Component {
	let result = inner;
	if (fields.length > 0)
		result = withTrailingLine(result, theme.fg("dim", fields.map((field) => `${field.label}: ${field.value}`).join(" · ")));
	if (omitted > 0) result = withTrailingLine(result, theme.fg("dim", `… ${omitted} omitted before persistence`));
	return result;
}

function renderProjectedPresentation(
	presentation: GenericVehiclePresentation,
	options: ToolRenderResultOptions,
	theme: Theme,
	progressBarGlyphs?: ProgressBarGlyphs | ProgressBarGlyphStyle,
): Component {
	const view = presentation.view;
	switch (view.kind) {
		case "empty":
			return new Text({ text: theme.fg("dim", "No results."), measure });
		case "progress":
			return view.value === undefined
				? new Text({ text: theme.fg("dim", view.text), measure })
				: progressBarFor({ value: view.value, max: view.max }, theme, progressBarGlyphs);
		case "fields":
			return appendPresentationAnnotations(renderedFields(view.fields, theme), [], view.completeness.omitted, theme);
		case "narrative": {
			const text = new CollapsibleText({ text: view.text, collapsedLines: options.expanded ? Number.MAX_SAFE_INTEGER : 5, measure });
			return appendPresentationAnnotations(text, view.fields, view.completeness.omitted, theme);
		}
		case "json": {
			const text = new CollapsibleText({ text: view.preview, collapsedLines: 5, headerStyle: (s) => theme.fg("dim", s), measure });
			if (options.expanded) text.expand();
			return appendPresentationAnnotations(text, [], view.completeness.omitted, theme);
		}
		case "list": {
			const visibleCount = options.expanded ? view.items.length : Math.min(DEFAULT_VISIBLE_ROWS, view.items.length);
			const lines = renderTruncatedList({
				items: view.items,
				expanded: options.expanded,
				visibleCount,
				formatItem: (item) => theme.fg("text", item),
				moreLine: (hiddenCount) => moreRowsLine(theme, hiddenCount),
			});
			return appendPresentationAnnotations(new Text({ text: lines.join("\n"), measure }), view.fields, view.completeness.omitted, theme);
		}
		case "table": {
			const objects = view.rows.map((row) => Object.fromEntries(view.columns.map((column, index) => [column, row[index] ?? ""])));
			const table = deriveTableColumns(objects);
			const rendered = table
				? renderBoundedTable({
						...table,
						expanded: options.expanded,
						visibleRowCount: DEFAULT_VISIBLE_ROWS,
						moreLine: (hiddenCount) => moreRowsLine(theme, hiddenCount),
						headerStyle: (s) => theme.fg("muted", theme.bold(s)),
						measure,
					})
				: new Text({ text: theme.fg("dim", "No results."), measure });
			const omitted = view.completeness.omitted;
			const columnNote = view.columnsOmitted > 0 ? [{ label: "columns", value: `${view.columnsOmitted} omitted` }] : [];
			return appendPresentationAnnotations(rendered, [...view.fields, ...columnNote], omitted, theme);
		}
	}
}

function renderModelContentFallback(result: AgentToolResult<unknown>, options: ToolRenderResultOptions, theme: Theme): Component {
	const text = result.content.map((block) => (block.type === "text" ? block.text : `[${block.type}]`)).join("\n");
	return new CollapsibleText({
		text: theme.fg("dim", text || "No presentation details."),
		collapsedLines: options.expanded ? Number.MAX_SAFE_INTEGER : 5,
		measure,
	});
}

/**
 * A closed, compiler-verifiable alternative to the shape-probing chain below: a consumer types
 * its own operation-name union and builds a `satisfies Record<OperationName, VehiclePresenter>`
 * map (see RegisterVehicleToolsOptions.renderPresenters in vehicle-pi.ts), so TypeScript itself
 * rejects a manifest operation with no assigned presenter at compile time, rather than that gap
 * only ever being discoverable at runtime (which is all the opt-in renderCoverage diagnostic can
 * do). Returning undefined means "this presenter doesn't have anything special for this output",
 * falling through to the generic shape-probing chain -- a presenter is never required to handle
 * every possible output shape for its own operation, only the ones worth curating.
 */
export type VehiclePresenter = (output: unknown, options: ToolRenderResultOptions, theme: Theme) => Component | undefined;

export function renderVehicleResult(
	descriptor: VehicleOperationDescriptor,
	result: AgentToolResult<unknown>,
	options: ToolRenderResultOptions,
	theme: Theme,
	context: RenderResultContext,
	progressBarGlyphs?: ProgressBarGlyphs | ProgressBarGlyphStyle,
	/** Keyed by descriptor.name (not versioned -- a presenter targets the operation's stable identity, matching renderCoverage's own operations list). Omitted (the default) preserves today's behavior for every existing consumer exactly. */
	presenters?: Readonly<Record<string, VehiclePresenter>>,
): Component {
	const details = result.details as { output?: unknown; progress?: unknown; presentation?: unknown } | undefined;
	const projected = details && Object.hasOwn(details, "presentation") ? parseGenericVehiclePresentation(details.presentation) : undefined;

	if (options.isPartial) {
		return projected
			? renderProjectedPresentation(projected, options, theme, progressBarGlyphs)
			: progressBarFor(details?.progress, theme, progressBarGlyphs);
	}

	if (context.isError) {
		const text = result.content.map((c) => (c.type === "text" ? c.text : `[${c.type}]`)).join("\n");
		return new CollapsibleText({
			text: theme.fg("error", text),
			collapsedLines: options.expanded ? Number.MAX_SAFE_INTEGER : 5,
			measure,
		});
	}

	if (projected) return renderProjectedPresentation(projected, options, theme, progressBarGlyphs);
	if (!details || !Object.hasOwn(details, "output")) return renderModelContentFallback(result, options, theme);

	// Compatibility window for historical session rows persisted before vehicle.tool-details/v1.
	const output = details.output;

	// A registered presenter, if any, always gets first refusal -- a consumer with real domain
	// knowledge of its own operation is more authoritative than any generic shape guess below,
	// including the bare-scalar checks that immediately follow.
	const presenter = presenters?.[descriptor.name];
	if (presenter) {
		const rendered = presenter(output, options, theme);
		if (rendered) return rendered;
	}

	// A bare scalar previously fell to JSON.stringify below -- harmless for a number/boolean
	// (identical to String()) but visibly wrong for a string, which JSON-quotes and
	// backslash-escapes it (e.g. tasks.context's plain-text plan summary).
	if (typeof output === "string") {
		return new CollapsibleText({ text: theme.fg("text", output), collapsedLines: options.expanded ? Number.MAX_SAFE_INTEGER : 5, measure });
	}
	if (typeof output === "number" || typeof output === "boolean") {
		return new Text({ text: theme.fg("text", String(output)), measure });
	}
	if (Array.isArray(output)) {
		const rendered = renderArrayOutput(output, options, theme);
		if (rendered) return rendered;
	} else {
		const envelope = singleArrayEnvelope(output);
		if (envelope) {
			const rendered = renderArrayOutput(envelope.items, options, theme);
			if (rendered) {
				return envelope.siblings.length > 0 ? withTrailingLine(rendered, theme.fg("dim", formatSiblingLine(envelope.siblings))) : rendered;
			}
		} else {
			const multiArray = multiArrayEnvelope(output);
			const multiRendered = multiArray ? renderMultiArrayEnvelope(multiArray, options, theme) : undefined;
			if (multiRendered) return multiRendered;
			const plain = plainContentEnvelope(output);
			if (plain) {
				const rendered = new CollapsibleText({ text: plain.text, collapsedLines: options.expanded ? Number.MAX_SAFE_INTEGER : 5, measure });
				return plain.siblings.length > 0 ? withTrailingLine(rendered, theme.fg("dim", formatSiblingLine(plain.siblings))) : rendered;
			}
			const record = recordEnvelope(output);
			if (record) return renderRecordEnvelope(record, theme);
		}
	}

	const text = JSON.stringify(output, null, 2) ?? "null";
	const collapsible = new CollapsibleText({ text, collapsedLines: 5, headerStyle: (s) => theme.fg("dim", s), measure });
	if (options.expanded) collapsible.expand();
	return collapsible;
}
