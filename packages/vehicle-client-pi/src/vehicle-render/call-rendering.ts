/**
 * renderVehicleCall -- one line summarizing a pending Vehicle tool call: effect-colored operation
 * name, a recognized identity argument, and the rest of the args, with credential/sensitive
 * fields sanitized per the operation's own input schema. Split out of vehicle-render.ts's own
 * bundled concerns (Vehicle Pass 1 SRP audit finding #6) -- the call-rendering half, cleanly
 * separable from the result-rendering half's own envelope-detection chain.
 */

import {
	isVehicleCredentialFieldName,
	type JsonSchema,
	VEHICLE_SCHEMA_PRESENTATION_EXTENSION,
	type VehicleEffect,
	type VehicleOperationDescriptor,
} from "@danypops/vehicle-core";
import type { Theme, ThemeColor, ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import { firstDistinctStyle, Text } from "malevich-tui-components";
import { measure, truncateToWidth } from "./text-safety.js";

// ToolRenderContext itself isn't part of the public export barrel; derive
// its shape from the exported ToolDefinition so this stays in sync with
// whatever Pi actually passes, instead of hand-duplicating the interface.
export type RenderCallContext = Parameters<NonNullable<ToolDefinition["renderCall"]>>[2];

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
 * one-line args summary has no per-physical-line contract to split into (unlike the result side's
 * own multi-line components); a multi-paragraph value like tasks.create's body must stay one
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
