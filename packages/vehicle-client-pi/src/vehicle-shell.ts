import {
	type JsonSchema,
	VEHICLE_EFFECTS,
	type VehicleEffect,
	type VehicleManifestOperation,
	type VehicleOperationDescriptor,
} from "@danypops/vehicle-core";
import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { reportModuleLoad, reportShellRegistered, reportToolsListExecute, reportToolsManExecute } from "./client-diagnostics.js";
import { syncManagedActiveTools, tryExtensionRuntimeAction } from "./pi-tool-availability.js";
import type { DiscoveredVehicle } from "./vehicle-shell-broker.js";
import { type InProcessDiscoveredVehicle, listInProcessVehicles } from "./vehicle-shell-registry.js";

reportModuleLoad(import.meta.url);

/**
 * A decaying-TTL cache over Pi's active-tool set, turn-scoped. Every tracked tool name carries a
 * current and a starting TTL (in turns); a tool actually called during a turn is refreshed back to
 * its own starting value, everything else decrements by one -- reaching zero evicts it (removed
 * from the tracker; the underlying Pi tool stays registered, just inactive until re-seeded).
 *
 * Deliberately name-keyed and Pi-agnostic: this file never touches ExtensionAPI directly, so its
 * decay/refresh logic is testable as a pure state machine. Shared by every vehicle in this process
 * (see the module-level singleton this file itself owns below) -- tool names are already globally
 * unique process-wide (that's precisely why two vehicles registering the same name is a problem in
 * the first place), so one tracker safely holds every vehicle's own entries side by side.
 */
export class VehicleShellTtlTracker {
	private readonly entries = new Map<string, { current: number; readonly starting: number }>();
	private readonly calledThisTurn = new Set<string>();

	/** Starts (or re-activates) tracking a tool name at the given starting TTL -- also used to
	 * refresh an already-tracked tool back to full TTL (e.g. a repeat tools_man call). */
	seed(toolName: string, startingTtl: number): void {
		this.entries.set(toolName, { current: startingTtl, starting: startingTtl });
	}

	/** Marks a tracked tool as called this turn -- a no-op for a name this tracker isn't tracking
	 * (the two meta-tools themselves, or any tool outside this Vehicle's own managed set). */
	recordCall(toolName: string): void {
		if (this.entries.has(toolName)) this.calledThisTurn.add(toolName);
	}

	/**
	 * Applies one turn's decay: a tool called this turn resets to its own starting TTL (stays
	 * warm, not just "not yet decremented"); every other tracked tool decrements by one. A tool
	 * that reaches zero is evicted (removed from tracking) and reported in the returned list.
	 */
	tick(): { readonly evicted: readonly string[] } {
		const evicted: string[] = [];
		for (const [toolName, entry] of this.entries) {
			if (this.calledThisTurn.has(toolName)) {
				entry.current = entry.starting;
				continue;
			}
			entry.current -= 1;
			if (entry.current <= 0) evicted.push(toolName);
		}
		for (const toolName of evicted) this.entries.delete(toolName);
		this.calledThisTurn.clear();
		return { evicted };
	}

	/** Every currently-tracked (non-evicted) tool name -- the TTL-managed subset of the active set. */
	trackedNames(): readonly string[] {
		return [...this.entries.keys()];
	}

	isTracked(toolName: string): boolean {
		return this.entries.has(toolName);
	}

	/** Turns remaining before this tool decays out, or undefined when it isn't currently tracked --
	 * the read-only counterpart to seed()/tick(), for a caller (tools_type) that needs to report
	 * "how much longer is this callable" without mutating anything itself. */
	remainingTurns(toolName: string): number | undefined {
		return this.entries.get(toolName)?.current;
	}
}

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

function shellQueryScore(descriptor: VehicleOperationDescriptor, query: string, scope: ShellQueryScope = "all"): number | undefined {
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

function regexQueryScore(descriptor: VehicleOperationDescriptor, regex: RegExp, scope: ShellQueryScope = "all"): number | undefined {
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
function formatOperationOneLinerVerbose(descriptor: VehicleManifestOperation): string {
	const oneLiner = formatOperationOneLiner(descriptor);
	const properties = formatSchemaProperties(descriptor.inputSchema);
	if (properties.length === 0) return oneLiner;
	return [oneLiner, "  parameters:", ...properties].join("\n");
}

const DEFAULT_LIST_TOOL_NAME = "tools_list";
const DEFAULT_MAN_TOOL_NAME = "tools_man";
const DEFAULT_TYPE_TOOL_NAME = "tools_type";
/** Illustrative starting points, not load-bearing constants -- tune from real usage (see the
 * Vehicle Shell design discussion this implements). Tuned up from an initial 10/3: a discovered
 * tool decaying in 3 unused turns proved too aggressive in practice -- a normal multi-step
 * investigation (read something, reason about it, call something else, come back) routinely
 * spans more than 3 turns between two calls to the same tool, forcing a needless repeat
 * tools_man round-trip on a tool the agent had already activated moments earlier. */
const DEFAULT_CORE_TTL_TURNS = 20;
const DEFAULT_DISCOVERED_TTL_TURNS = 8;

/** The subset of a registered Pi tool's own bookkeeping the shell needs to decide what's
 * activatable. `vehicleName` disambiguates `operationName` across vehicles (e.g. two vehicles
 * can both legitimately have a "focus.set" core operation) now that one shared tracker/managed
 * set covers every vehicle in the process, not just one. Deliberately narrower than vehicle-pi.ts's
 * own RegisteredPiVehicleTool so this file never has to import from (and create a cycle with)
 * vehicle-pi.ts. */
export interface VehicleShellManagedTool {
	readonly vehicleName: string;
	readonly toolName: string;
	readonly operationName: string;
	readonly available: boolean;
	readonly blocked: boolean;
}

export interface VehicleShellOptions {
	/** Operation names (VehicleOperationDescriptor.name, e.g. "tasks.create") that boot active with
	 * coreTtlTurns, needing no tools_man call. Everything else boots inactive, reachable only via
	 * tools_man. Domain-agnostic on purpose -- this package never names a specific consumer's
	 * operations; the consumer supplies its own list. */
	readonly coreOperations?: readonly string[];
	/** Starting TTL, in turns, for a core operation. Default 10 -- illustrative, tune from usage. */
	readonly coreTtlTurns?: number;
	/** Starting TTL, in turns, for an operation activated via tools_man. Default 3 -- illustrative. */
	readonly discoveredTtlTurns?: number;
	/**
	 * Pi tool name for the list meta-tool. Default "tools_list". The meta-tools are a single,
	 * process-wide, vehicle-agnostic pair (see ensureVehicleShellHandle below) -- whichever vehicle
	 * happens to be the first in this process to enable shell mode at all decides these two names
	 * for every vehicle that follows; a later vehicle's own different preference, if any, is
	 * ignored. Not worth plumbing a conflict error for: every real consumer today uses the default.
	 */
	readonly listToolName?: string;
	/** Pi tool name for the man meta-tool. Default "tools_man". See listToolName's own note on
	 * first-writer-wins scope. */
	readonly manToolName?: string;
	/** Pi tool name for the type meta-tool. Default "tools_type". See listToolName's own note on
	 * first-writer-wins scope. */
	readonly typeToolName?: string;
	/**
	 * Opt-in short-TTL cache, in milliseconds, over tools_list's own aggregated cross-vehicle
	 * discovery + manifest listing -- mirrors apropos/whatis's own "query a periodically-rebuilt
	 * index, don't rescan every page live" pattern (mandb), applied here so N discovered vehicles
	 * cost N live round trips only once per TTL window, not on every single tools_list call, and one
	 * slow/hung vehicle can't delay every call indefinitely.
	 *
	 * Default 0 -- OFF, always a live fetch, never cached. This is a deliberate choice, not just a
	 * conservative default: a real, pre-existing, explicitly-tested guarantee ("tools_list converges
	 * dynamically within one already-running pi process ... with no pi restart") genuinely regressed
	 * the moment ANY caching was enabled by default -- two tools_list calls closer together than the
	 * TTL saw a real live daemon mutation made in between as invisible until expiry. Opt in explicitly
	 * only if that tradeoff (fewer round trips/one-slow-vehicle isolation, vs. up to this many
	 * milliseconds of staleness) is genuinely worth it for your own consumer.
	 *
	 * tools_man/tools_type deliberately never read this cache regardless of this setting -- their own
	 * activation/documentation/status-check paths must always see live state.
	 */
	readonly aggregateCacheTtlMs?: number;
}

export interface VehicleShellHandle {
	readonly tracker: VehicleShellTtlTracker;
	readonly listToolName: string;
	readonly manToolName: string;
	readonly typeToolName: string;
	/** Live, mutable view of every vehicle's own managed tools in this process -- refreshVehicleShellManagedTools
	 * keeps this current across a refreshVehicleToolAvailability call, since the per-turn decay
	 * handler and the man-page tool both close over this same handle rather than a stale snapshot. */
	managedTools: readonly VehicleShellManagedTool[];
	readonly coreOperationNames: ReadonlySet<string>;
	/** Starting TTL a core operation is (re-)seeded with -- kept on the handle so a later refresh
	 * can seed a core operation that just became available the same way initial registration did. */
	readonly coreTtlTurns: number;
	/** tools_list's own aggregate cache TTL, in milliseconds -- see VehicleShellOptions.aggregateCacheTtlMs. */
	readonly aggregateCacheTtlMs: number;
	/** Mutable cache slot tools_list reads/writes through cachedAggregatedOperations -- undefined
	 * until first populated, or once expired and about to be refreshed. */
	aggregateCache?: { readonly expiresAt: number; readonly operations: readonly VehicleManifestOperation[] };
}

/**
 * Updates one vehicle's own managed-tool bookkeeping after a fresh availability check (e.g. a
 * credential became available, or a /safety override changed) -- an upsert by toolName (globally
 * unique process-wide) against the shared handle's full managedTools list, so refreshing one
 * vehicle's own tools never clobbers any other vehicle's entries sharing this same handle. A core
 * operation that just became available and isn't currently tracked is (re-)seeded fresh, matching
 * what initial registration would have done for it -- every other tracked tool (core or discovered,
 * this vehicle's own or another's) is left exactly as the decay cycle already has it; "core" only
 * ever means "seeded generously," never "exempt from decay" (see desiredShellActiveNames, which
 * reads tracker membership alone, not coreOperationNames, for who's currently active).
 */
export function refreshVehicleShellManagedTools(handle: VehicleShellHandle, incoming: readonly VehicleShellManagedTool[]): void {
	const incomingToolNames = new Set(incoming.map((tool) => tool.toolName));
	handle.managedTools = [...handle.managedTools.filter((tool) => !incomingToolNames.has(tool.toolName)), ...incoming];
	for (const tool of incoming) {
		if (handle.coreOperationNames.has(tool.operationName) && tool.available && !tool.blocked && !handle.tracker.isTracked(tool.toolName)) {
			handle.tracker.seed(tool.toolName, handle.coreTtlTurns);
		}
	}
}

/** Every Pi tool name this handle could ever legitimately activate -- the full `managed` superset
 * syncManagedActiveTools requires. The three meta-tools are always included: they're a single,
 * process-wide capability now, never contingent on any one vehicle's own "did I win ownership"
 * check the way they used to be. */
function allManagedNames(handle: VehicleShellHandle): string[] {
	return [...handle.managedTools.map((tool) => tool.toolName), handle.listToolName, handle.manToolName, handle.typeToolName];
}

/**
 * The active set a shell handle wants right now: its three meta-tools (always active), every
 * vehicle's core operations that are currently available and unblocked, and whatever tools_man has
 * activated that hasn't yet decayed out -- re-filtered against current availability so a tool that
 * became unavailable/blocked since it was seeded doesn't stay active just because its TTL hasn't
 * hit zero.
 */
export function desiredShellActiveNames(handle: VehicleShellHandle): string[] {
	const byToolName = new Map(handle.managedTools.map((tool) => [tool.toolName, tool]));
	const tracked = handle.tracker.trackedNames().filter((toolName) => {
		const tool = byToolName.get(toolName);
		return tool?.available === true && !tool.blocked;
	});
	return [...new Set([handle.listToolName, handle.manToolName, handle.typeToolName, ...tracked])];
}

function applyShellActivation(pi: ExtensionAPI, handle: VehicleShellHandle): void {
	syncManagedActiveTools(pi, allManagedNames(handle), desiredShellActiveNames(handle));
}

/** A vehicle's own operation descriptor, relabeled with its namespaced "<vehicleName>:<operation>"
 * name for listing/matching/activating -- a shallow clone, never mutates the original manifest.
 * Applied uniformly to every vehicle now, including whichever one happens to house the shared
 * meta-tools' own creation call: there is no more "local, unprefixed" special case. */
function namespacedDescriptor(vehicleName: string, descriptor: VehicleManifestOperation): VehicleManifestOperation {
	return { ...descriptor, name: `${vehicleName}:${descriptor.name}` };
}

/**
 * Every vehicle currently reachable -- in-process ones (free, always-current, no IO) plus
 * cross-process ones discovered via the shared Vehicle Handle Directory (a real Vehicle daemon
 * this process doesn't itself host an extension for). In-process wins on a name collision: it's
 * free, always-current, and never subject to a stale/dead filesystem handle the way a cross-process
 * daemon's own written handle can be. Discovery failure (cross-process only -- in-process listing
 * never throws) degrades to the in-process list alone rather than breaking tools_list/tools_man.
 *
 * A dynamic import, deliberately -- vehicle-shell-broker.ts pulls in @danypops/vehicle-server/paths
 * and @danypops/vehicle-client/http, both real runtime dependencies nobody should have to load
 * merely because this module itself loaded. A static top-level import here would defeat that: ES
 * module imports are evaluated eagerly for the whole graph, so loading vehicle-shell.ts at all
 * would transitively load vehicle-server's module -- confirmed as a real regression live, breaking
 * Node's native (--experimental-strip-types) ESM loader for any consumer whose own load-path test
 * exercises it, since Node unconditionally refuses to strip types for a .ts file under node_modules.
 */
async function discoverAllVehicles(): Promise<readonly (InProcessDiscoveredVehicle | DiscoveredVehicle)[]> {
	const inProcess = listInProcessVehicles();
	try {
		const { discoverForeignVehicles } = await import("./vehicle-shell-broker.js");
		const foreign = await discoverForeignVehicles();
		const inProcessNames = new Set(inProcess.map((vehicle) => vehicle.name));
		return [...inProcess, ...foreign.filter((vehicle) => !inProcessNames.has(vehicle.name))];
	} catch {
		return inProcess;
	}
}

/** Fresh per call for every vehicle (mirrors what a single vehicle's own refreshOwnManifest used
 * to do, generalized to everyone) -- falls back to the snapshot manifest discovery already
 * returned on a failed re-fetch, so one unreachable vehicle never breaks another's listing. */
async function namespacedOperationsOf(
	vehicles: readonly (InProcessDiscoveredVehicle | DiscoveredVehicle)[],
): Promise<VehicleManifestOperation[]> {
	const perVehicle = await Promise.all(
		vehicles.map(async (vehicle) => {
			const operations = await vehicle.client.manifest().then(
				(manifest) => manifest.operations,
				() => vehicle.manifest.operations,
			);
			return operations.map((op) => namespacedDescriptor(vehicle.name, op));
		}),
	);
	return perVehicle.flat();
}

/**
 * Default OFF (0 -- always a live fetch, never cached) -- see cachedAggregatedOperations' own doc
 * comment for why. Set explicitly via VehicleShellOptions.aggregateCacheTtlMs to opt in.
 */
export const DEFAULT_AGGREGATE_CACHE_TTL_MS = 0;

/**
 * tools_list's own cached front-end onto discoverAllVehicles()+namespacedOperationsOf(): a cache
 * hit within `ttlMs` of the last real fetch returns the SAME array reference without touching any
 * vehicle again; a miss (first call, past expiry, or ttlMs <= 0) does a genuinely fresh fetch and
 * refreshes the cache. `now` is injectable so a test can exercise expiry deterministically without
 * a real sleep -- real callers always use the default (Date.now).
 *
 * `ttlMs <= 0` (the default) never caches at all -- confirmed live as a real, deliberate choice,
 * not just a conservative default: a real, pre-existing, explicitly-tested guarantee
 * ("tools_list converges dynamically within one already-running pi process ... with no pi
 * restart", vehicle-pi-dynamic-tools.test.ts) genuinely regressed the instant ANY caching was
 * introduced by default -- two tools_list calls closer together than the TTL (entirely realistic:
 * that suite's own real-process scripted turns run well under a second apart) saw a real live
 * daemon mutation made in between as invisible until expiry. A caller who explicitly wants the
 * round-trip-reduction/one-slow-vehicle-isolation tradeoff opts in via aggregateCacheTtlMs;
 * nobody gets it by surprise.
 *
 * Deliberately never called from tools_man/tools_type -- see their own comments for why their
 * resolution/activation/status-check paths must always see live state regardless of this setting.
 */
async function cachedAggregatedOperations(
	handle: Pick<VehicleShellHandle, "aggregateCache">,
	ttlMs: number,
	now: () => number = Date.now,
): Promise<readonly VehicleManifestOperation[]> {
	if (ttlMs <= 0) return namespacedOperationsOf(await discoverAllVehicles());
	const nowMs = now();
	if (handle.aggregateCache && handle.aggregateCache.expiresAt > nowMs) return handle.aggregateCache.operations;
	const vehicles = await discoverAllVehicles();
	const operations = await namespacedOperationsOf(vehicles);
	handle.aggregateCache = { expiresAt: nowMs + ttlMs, operations };
	return operations;
}

/** Splits a namespaced "<vehicle>:<operation>" name; undefined when name carries no vehicle prefix at all. */
export function splitNamespacedName(name: string): { vehicleName: string; operationName: string } | undefined {
	const separator = name.indexOf(":");
	if (separator <= 0 || separator === name.length - 1) return undefined;
	return { vehicleName: name.slice(0, separator), operationName: name.slice(separator + 1) };
}

export type OperationNameResolution =
	| { readonly kind: "none" }
	| { readonly kind: "ambiguous"; readonly candidates: readonly string[] }
	| {
			readonly kind: "unique";
			readonly vehicleName: string;
			readonly operationName: string;
			readonly descriptor: VehicleManifestOperation;
	  };

/**
 * Resolves a tools_man name argument to exactly one operation against `operations` (already
 * namespaced, e.g. namespacedOperationsOf's own output) -- the shared logic behind both today's
 * fully-namespaced "vehicle:operation" lookup (unchanged: a direct match against the namespaced
 * name) and bare-name resolution (no ":" at all): search every vehicle's own operations for an
 * EXACT match on the bare operation name alone, mirroring bash's `type -a` -- show every binding
 * rather than silently pick one when more than one vehicle happens to expose the same operation
 * name. Zero matches and exactly one match behave identically whether the input was namespaced or
 * bare; only the ambiguous case is bare-name-specific (a fully-namespaced name is either the one
 * real operation or nothing at all -- there is nothing left to disambiguate).
 */
export function resolveOperationName(name: string, operations: readonly VehicleManifestOperation[]): OperationNameResolution {
	const split = splitNamespacedName(name);
	if (split) {
		const descriptor = operations.find((op) => op.name === name);
		return descriptor
			? { kind: "unique", vehicleName: split.vehicleName, operationName: split.operationName, descriptor }
			: { kind: "none" };
	}
	const matches = operations.flatMap((op) => {
		const opSplit = splitNamespacedName(op.name);
		return opSplit && opSplit.operationName === name ? [{ op, opSplit }] : [];
	});
	if (matches.length === 0) return { kind: "none" };
	if (matches.length > 1) return { kind: "ambiguous", candidates: matches.map((match) => match.op.name) };
	const only = matches[0]!;
	return { kind: "unique", vehicleName: only.opSplit.vehicleName, operationName: only.opSplit.operationName, descriptor: only.op };
}

export type OperationTypeResult =
	| { readonly status: "active"; readonly toolName: string; readonly remainingTtlTurns: number | undefined }
	| { readonly status: "dormant" }
	| { readonly status: "blocked"; readonly reason: string }
	| { readonly status: "unreachable"; readonly vehicleName: string }
	| { readonly status: "unknown" }
	| { readonly status: "ambiguous"; readonly candidates: readonly string[] };

/**
 * The `type`-equivalent classification behind tools_type -- read-only, never activates anything
 * or touches the TTL tracker's own state (unlike tools_man's resolution, which seeds/refreshes a
 * tool's TTL as a side effect of documenting it).
 *
 * - "active": already a real, currently-tracked Pi tool -- callable this turn, with its live
 *   toolName and however many turns remain before it decays (VehicleShellTtlTracker.remainingTurns).
 * - "dormant": a known operation (live in `operations`) that tools_man hasn't activated (or has
 *   decayed back out of activity) -- calling tools_man on it would work right now.
 * - "blocked": known and pre-registered, but currently unavailable or blocked by safety policy --
 *   mirrors tools_man's own managed.available/managed.blocked distinction exactly, folded into one
 *   status with a distinguishing `reason` rather than reimplementing two parallel checks.
 * - "unreachable": a namespaced name whose vehicle prefix was previously known to this process
 *   (it appears in `managedTools` -- i.e. this process registered at least one of its operations
 *   at some point) but currently produces zero live operations at all -- the vehicle itself seems
 *   to have gone away, not just this one operation. Real motivating incident: Papyrus silently
 *   vanishing from discovery for an extended stretch, indistinguishable at the time from Papyrus
 *   never having existed at all. Deliberately narrower than "any name that ever existed": a BARE
 *   name with zero live matches is reported as "unknown", not "unreachable" -- there is no vehicle
 *   prefix to check history against, and guessing which of possibly several past vehicles the
 *   caller meant would be worse than an honest "not found".
 * - "unknown": no live vehicle currently produces this operation, and (for a namespaced name) its
 *   vehicle prefix was never known to this process either.
 * - "ambiguous": a bare name matching more than one vehicle's own operation -- see
 *   resolveOperationName's own doc comment.
 */
export function classifyOperationName(
	name: string,
	operations: readonly VehicleManifestOperation[],
	managedTools: readonly VehicleShellManagedTool[],
	tracker: VehicleShellTtlTracker,
): OperationTypeResult {
	const resolved = resolveOperationName(name, operations);
	if (resolved.kind === "ambiguous") return { status: "ambiguous", candidates: resolved.candidates };
	if (resolved.kind === "unique") {
		const managed = managedTools.find((tool) => tool.vehicleName === resolved.vehicleName && tool.operationName === resolved.operationName);
		if (!managed) return { status: "dormant" };
		if (!managed.available) return { status: "blocked", reason: "currently unavailable" };
		if (managed.blocked) return { status: "blocked", reason: "blocked by the current safety policy" };
		if (tracker.isTracked(managed.toolName)) {
			return { status: "active", toolName: managed.toolName, remainingTtlTurns: tracker.remainingTurns(managed.toolName) };
		}
		return { status: "dormant" };
	}
	const split = splitNamespacedName(name);
	if (split) {
		const vehicleStillLive = operations.some((op) => splitNamespacedName(op.name)?.vehicleName === split.vehicleName);
		const vehiclePreviouslyKnown = managedTools.some((tool) => tool.vehicleName === split.vehicleName);
		if (!vehicleStillLive && vehiclePreviouslyKnown) return { status: "unreachable", vehicleName: split.vehicleName };
	}
	return { status: "unknown" };
}

/** One human-readable line per classifyOperationName result, for tools_type's own text output. */
export function formatOperationTypeLine(name: string, result: OperationTypeResult, manToolName: string, listToolName: string): string {
	switch (result.status) {
		case "active": {
			const ttl = result.remainingTtlTurns !== undefined ? ` (${result.remainingTtlTurns} turn(s) remaining before it decays)` : "";
			return `${name}: active -- callable now as ${result.toolName}${ttl}.`;
		}
		case "dormant":
			return `${name}: dormant -- known, not yet activated. Call ${manToolName} on it to make it callable.`;
		case "blocked":
			return `${name}: blocked -- ${result.reason}.`;
		case "unreachable":
			return `${name}: unreachable -- vehicle "${result.vehicleName}" was previously known but produces no operations right now.`;
		case "unknown":
			return `${name}: unknown -- no such operation is currently discoverable. Use ${listToolName} to browse available names.`;
		case "ambiguous":
			return `${name}: ambiguous -- provided by ${result.candidates.length} vehicles (${result.candidates.join(", ")}). Use one of these exact names instead.`;
	}
}

function createToolsListTool(listToolName: string, manToolName: string, handle: VehicleShellHandle): ToolDefinition {
	return {
		name: listToolName,
		label: "List Tools",
		description: `Lists every registered Vehicle's own operations, one line each, namespaced "<vehicle>:<operation>" (e.g. "papyrus:tasks.create"). Optionally filter by a keyword matched against the name and description, and/or by effect (${VEHICLE_EFFECTS.join(" | ")}) -- e.g. effect:"read" to browse only side-effect-free operations first. mode:"regex" treats query as a case-insensitive regular expression instead of a plain substring/prefix match (apropos's own default matching mode). scope:"name" restricts matching to the name alone, skipping the description. verbosity:"high" adds each match's own parameter/schema summary, avoiding a separate ${manToolName} round trip when browsing several operations' shape at once. Use ${manToolName} on a name from this list (or any name you already know) to see its full documentation (permissions/effect/idempotency too) and make it callable.`,
		parameters: Type.Object({
			query: Type.Optional(
				Type.String({ description: "Keyword to filter by (matched against operation name and description); omit to list everything." }),
			),
			mode: Type.Optional(
				Type.Union([Type.Literal("substring"), Type.Literal("regex")], {
					description:
						'"substring" (default): today\'s plain substring/prefix match. "regex": treat query as a case-insensitive regular expression instead, matched against name and description independently.',
				}),
			),
			effect: Type.Optional(
				Type.Union(
					VEHICLE_EFFECTS.map((value) => Type.Literal(value)),
					{
						description:
							"Restrict to operations with exactly this effect classification; omit to list every effect (today's default). Combines with query as AND, not a replacement for it.",
					},
				),
			),
			scope: Type.Optional(
				Type.Union([Type.Literal("all"), Type.Literal("name")], {
					description:
						'"all" (default): match query against name OR description, today\'s exact existing behavior. "name": match against the operation name only (apropos --names-only parity).',
				}),
			),
			verbosity: Type.Optional(
				Type.Union([Type.Literal("low"), Type.Literal("high")], {
					description:
						'"low" (default): today\'s exact one-liner-per-match output. "high": each match\'s one-liner plus its parameter/schema summary.',
				}),
			),
		}),
		async execute(_toolCallId, params) {
			const {
				query = "",
				mode = "substring",
				effect,
				scope = "all",
				verbosity = "low",
			} = params as {
				query?: string;
				mode?: "substring" | "regex";
				effect?: VehicleEffect;
				scope?: ShellQueryScope;
				verbosity?: "low" | "high";
			};
			reportToolsListExecute("vehicle", query);
			const operations = await cachedAggregatedOperations(handle, handle.aggregateCacheTtlMs);

			let score: (descriptor: VehicleOperationDescriptor) => number | undefined;
			if (mode === "regex") {
				let regex: RegExp;
				try {
					regex = compileShellQueryRegex(query);
				} catch (error) {
					// Never an uncaught exception into the tool-calling harness -- an invalid regex is a
					// normal, expected user input, not a bug.
					return {
						content: [{ type: "text", text: `Invalid regex "${query}": ${error instanceof Error ? error.message : String(error)}` }],
						details: {},
					};
				}
				score = (descriptor) => regexQueryScore(descriptor, regex, scope);
			} else {
				score = (descriptor) => shellQueryScore(descriptor, query, scope);
			}

			const matches = operations
				.flatMap((descriptor, index) => {
					if (effect !== undefined && descriptor.effect !== effect) return [];
					const thisScore = score(descriptor);
					return thisScore === undefined ? [] : [{ descriptor, index, score: thisScore }];
				})
				.sort((left, right) => left.score - right.score || left.index - right.index)
				.map((entry) => entry.descriptor);
			const formatMatch = verbosity === "high" ? formatOperationOneLinerVerbose : formatOperationOneLiner;
			const text =
				matches.length === 0
					? `No operations matched "${query}"${effect ? ` with effect "${effect}"` : ""}.`
					: matches.map((descriptor) => formatMatch(descriptor)).join("\n");
			return {
				content: [{ type: "text", text }],
				details: { operations: matches.map((descriptor) => ({ name: descriptor.name, description: descriptor.description })) },
			};
		},
	};
}

function createToolsManTool(
	pi: ExtensionAPI,
	listToolName: string,
	manToolName: string,
	handle: VehicleShellHandle,
	discoveredTtlTurns: number,
): ToolDefinition {
	return {
		name: manToolName,
		label: "Tool Manual",
		description: `Shows full documentation for one or more Vehicle operations by their exact namespaced name (as seen from ${listToolName} or already known) and makes each one callable starting next turn. A name doesn't need to have been listed first. A bare, unprefixed name (no "vehicle:" part) also resolves as long as exactly one vehicle provides it -- ambiguous across more than one vehicle refuses and lists every real candidate instead of guessing.`,
		parameters: Type.Object({
			names: Type.Array(Type.String(), {
				description: 'Exact operation name(s), namespaced ("papyrus:tasks.create") or bare ("tasks.create") when unambiguous.',
				minItems: 1,
			}),
		}),
		async execute(_toolCallId, params) {
			const names = (params as { names: string[] }).names;
			reportToolsManExecute("vehicle", names);
			const byKey = new Map(handle.managedTools.map((tool) => [`${tool.vehicleName}:${tool.operationName}`, tool]));
			const vehicles = await discoverAllVehicles();
			const byVehicleName = new Map(vehicles.map((vehicle) => [vehicle.name, vehicle]));
			// Computed once for the whole batch, feeding both the fully-namespaced lookup (replacing the
			// old per-name single-vehicle client.manifest() call with the exact same "fresh, fallback to
			// snapshot on failure" semantics namespacedOperationsOf already provides -- and avoiding a
			// redundant re-fetch of the same vehicle when a batch names more than one of its operations)
			// and bare-name resolution across every vehicle. Deliberately NEVER goes through tools_list's
			// own cachedAggregatedOperations -- activation/documentation is consequential enough (and rare
			// enough per turn) that it must always see live state, never something up to a TTL window stale.
			const allOperations = await namespacedOperationsOf(vehicles);

			const pages = await Promise.all(
				names.map(async (name) => {
					const resolved = resolveOperationName(name, allOperations);
					if (resolved.kind === "none") return `${name}: no such operation. Use ${listToolName} to browse available names.`;
					if (resolved.kind === "ambiguous") {
						return `${name}: ambiguous -- provided by ${resolved.candidates.length} vehicles (${resolved.candidates.join(", ")}). Use one of these exact names instead.`;
					}
					const { vehicleName, operationName, descriptor: namespaced } = resolved;
					const fullName = `${vehicleName}:${operationName}`;
					const vehicle = byVehicleName.get(vehicleName);
					if (!vehicle) return `${fullName}: no such operation. Use ${listToolName} to browse available names.`;
					const seeAlso = relatedOperationNames(vehicleName, operationName, allOperations);

					const managed = byKey.get(fullName);
					if (managed) {
						if (!managed.available) return `${fullName}: currently unavailable (${manToolName} cannot activate it right now).`;
						if (managed.blocked) return `${fullName}: blocked by the current safety policy -- not activatable.`;
						handle.tracker.seed(managed.toolName, discoveredTtlTurns);
						return `${formatOperationManPage(namespaced, managed.toolName, seeAlso)}\n\n(now callable as ${managed.toolName})`;
					}

					const activateOperation = "activateOperation" in vehicle ? vehicle.activateOperation : undefined;
					if (!activateOperation) {
						return `${fullName}: known -- provided by Vehicle "${vehicleName}", discovered live via the shared Vehicle Handle Directory. Cross-process activation isn't wired here; not yet callable in this process.`;
					}
					// activateOperation needs the vehicle's own RAW (un-namespaced) descriptor -- `namespaced.name`
					// is "vehicle:operation", but activation/dispatch always uses the vehicle's own bare name.
					const rawDescriptor: VehicleManifestOperation = { ...namespaced, name: operationName };
					let toolName: string;
					try {
						toolName = activateOperation(rawDescriptor);
					} catch (error) {
						return `${fullName}: could not activate -- ${error instanceof Error ? error.message : String(error)}.`;
					}
					handle.managedTools = [...handle.managedTools, { vehicleName, toolName, operationName, available: true, blocked: false }];
					handle.tracker.seed(toolName, discoveredTtlTurns);
					return `${formatOperationManPage(namespaced, toolName, seeAlso)}\n\n(now callable as ${toolName})`;
				}),
			);
			applyShellActivation(pi, handle);
			return { content: [{ type: "text", text: pages.join("\n\n---\n\n") }], details: {} };
		},
	};
}

function createToolsTypeTool(listToolName: string, manToolName: string, typeToolName: string, handle: VehicleShellHandle): ToolDefinition {
	return {
		name: typeToolName,
		label: "Tool Type",
		description: `Reports how each name currently resolves -- "active" (callable right now, with the real toolName and turns remaining before it decays), "dormant" (known, needs ${manToolName} to activate), "blocked" (known but currently unavailable or blocked by safety policy), "unreachable" (a namespaced name whose vehicle used to be known but produces nothing live right now), "ambiguous" (a bare name matching more than one vehicle -- use one of the listed full names), or "unknown" (no such operation anywhere currently discoverable). Read-only -- unlike ${manToolName}, never activates anything or extends any TTL, so calling this never changes what's callable.`,
		parameters: Type.Object({
			names: Type.Array(Type.String(), {
				description: 'Exact or bare operation name(s), e.g. "papyrus:tasks.create" or "tasks.create".',
				minItems: 1,
			}),
		}),
		async execute(_toolCallId, params) {
			const names = (params as { names: string[] }).names;
			// Same as tools_man: deliberately always fresh, never tools_list's own cache -- a status check
			// that itself lags reality would defeat its whole diagnostic purpose.
			const vehicles = await discoverAllVehicles();
			const allOperations = await namespacedOperationsOf(vehicles);
			const results = names.map((name) => ({
				name,
				result: classifyOperationName(name, allOperations, handle.managedTools, handle.tracker),
			}));
			const text = results.map(({ name, result }) => formatOperationTypeLine(name, result, manToolName, listToolName)).join("\n");
			return {
				content: [{ type: "text", text }],
				details: { results: results.map(({ name, result }) => ({ name, ...result })) },
			};
		},
	};
}

const SHELL_HANDLE_KEY = Symbol.for("vehicle.shell.handle");

/**
 * The single, process-wide, vehicle-agnostic Vehicle Shell handle -- created by whichever vehicle's
 * own registerVehicleShell() call happens to run first, exactly like vehicle-shell-registry.ts's
 * own in-process vehicle registry, and for the same reason: `globalThis[Symbol.for(...)]` survives
 * module duplication across separately-installed npm packages (each with its own physical copy of
 * this file) the same way a plain module-level singleton wouldn't -- Symbol.for and globalThis are
 * both process-wide, not module-instance-scoped.
 *
 * This is the fix for the "whichever domain vehicle happens to load first becomes the accidental,
 * arbitrarily-named owner of tools_list/tools_man" problem: nobody "wins" anymore. The two
 * meta-tools are registered here, exactly once, bound to nothing vehicle-specific -- their own
 * closures always read every vehicle currently in the process (discoverAllVehicles), never one
 * particular vehicle's own manifest. Every subsequent call (from every other vehicle) is a pure
 * no-op that just returns the same shared handle to fold its own managed tools into.
 */
function ensureVehicleShellHandle(pi: ExtensionAPI, options: VehicleShellOptions): VehicleShellHandle {
	const holder = globalThis as { [SHELL_HANDLE_KEY]?: VehicleShellHandle };
	const existing = holder[SHELL_HANDLE_KEY];
	if (existing) return existing;

	const listToolName = options.listToolName ?? DEFAULT_LIST_TOOL_NAME;
	const manToolName = options.manToolName ?? DEFAULT_MAN_TOOL_NAME;
	const typeToolName = options.typeToolName ?? DEFAULT_TYPE_TOOL_NAME;
	const handle: VehicleShellHandle = {
		tracker: new VehicleShellTtlTracker(),
		listToolName,
		manToolName,
		typeToolName,
		managedTools: [],
		coreOperationNames: new Set(),
		coreTtlTurns: options.coreTtlTurns ?? DEFAULT_CORE_TTL_TURNS,
		aggregateCacheTtlMs: options.aggregateCacheTtlMs ?? DEFAULT_AGGREGATE_CACHE_TTL_MS,
	};
	holder[SHELL_HANDLE_KEY] = handle;

	// Distinct from "did another vehicle already claim it" (that concern doesn't exist anymore --
	// every vehicle just folds into this one shared handle) -- this guards against a truly
	// unrelated extension elsewhere in the process having registered a same-named tool of its own.
	// Pi has no unregisterTool(), so registering a second, permanently-unreachable copy would be
	// pure dead weight; skip it, but still track/decay our own operations exactly as normal.
	const runtime = tryExtensionRuntimeAction(() => pi.getAllTools());
	const claimedElsewhere = runtime.status === "ready" && runtime.value.some((tool) => tool.name === listToolName);
	reportShellRegistered("vehicle", listToolName, manToolName, !claimedElsewhere);
	if (!claimedElsewhere) {
		pi.registerTool(createToolsListTool(listToolName, manToolName, handle));
		pi.registerTool(createToolsManTool(pi, listToolName, manToolName, handle, options.discoveredTtlTurns ?? DEFAULT_DISCOVERED_TTL_TURNS));
		pi.registerTool(createToolsTypeTool(listToolName, manToolName, typeToolName, handle));
	}

	pi.on("tool_execution_end", (event) => {
		const toolName = (event as { toolName?: unknown }).toolName;
		if (typeof toolName === "string") handle.tracker.recordCall(toolName);
	});
	pi.on("turn_end", () => {
		handle.tracker.tick();
		applyShellActivation(pi, handle);
	});

	return handle;
}

/** Test-only: clears the process-wide shell handle singleton so each test gets a fresh one. Not
 * exported from the package's own public entry point. */
export function __resetVehicleShellHandleForTests(): void {
	delete (globalThis as { [SHELL_HANDLE_KEY]?: VehicleShellHandle })[SHELL_HANDLE_KEY];
}

/**
 * Ensures the shared, process-wide meta-tools exist (a no-op after the first real call, from any
 * vehicle), then folds this vehicle's own operations into the shared handle's bookkeeping --
 * seeding its declared core operations active, leaving the rest reachable only via tools_man.
 * Returns undefined (no-op, today's all-active behavior applies) when options is omitted --
 * opt-in only, per this package's own convention for a change that could alter an existing
 * consumer's visible tool surface.
 */
export function registerVehicleShell(
	pi: ExtensionAPI,
	vehicleName: string,
	managedTools: readonly VehicleShellManagedTool[],
	options: VehicleShellOptions | undefined,
): VehicleShellHandle | undefined {
	if (!options) return undefined;
	const handle = ensureVehicleShellHandle(pi, options);
	for (const operationName of options.coreOperations ?? []) (handle.coreOperationNames as Set<string>).add(operationName);
	refreshVehicleShellManagedTools(handle, managedTools);
	void vehicleName; // Kept for call-site symmetry with the pre-consolidation signature and future diagnostics; not otherwise needed today.
	return handle;
}

/** Applies (or re-applies, e.g. once the runtime is ready after session_start) the shell's
 * current desired active set -- the shell-mode counterpart of registerVehicleTools' own
 * syncAvailability closure for the non-shell path. */
export function applyVehicleShellActivation(pi: ExtensionAPI, handle: VehicleShellHandle): void {
	applyShellActivation(pi, handle);
}
