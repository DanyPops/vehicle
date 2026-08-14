import type { JsonSchema, VehicleManifestOperation, VehicleOperationDescriptor } from "@danypops/vehicle-core";
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

function shellQueryScore(descriptor: VehicleOperationDescriptor, query: string): number | undefined {
	const rawNeedle = query.trim().toLowerCase();
	if (rawNeedle.length === 0) return 0;
	const normalizedNeedle = normalizeShellTerms(query);
	const normalizedName = normalizeShellTerms(descriptor.name);
	if (normalizedNeedle.length === 0) {
		return `${descriptor.name} ${descriptor.description}`.toLowerCase().includes(rawNeedle) ? 3 : undefined;
	}
	if (normalizedName === normalizedNeedle) return 0;
	if (normalizedName.startsWith(normalizedNeedle)) return 1;
	if (normalizedName.includes(normalizedNeedle)) return 2;
	return `${descriptor.name} ${descriptor.description}`.toLowerCase().includes(rawNeedle) ? 3 : undefined;
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
export function formatOperationManPage(descriptor: VehicleOperationDescriptor, toolName: string): string {
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
	return lines.join("\n");
}

const DEFAULT_LIST_TOOL_NAME = "tools_list";
const DEFAULT_MAN_TOOL_NAME = "tools_man";
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
}

export interface VehicleShellHandle {
	readonly tracker: VehicleShellTtlTracker;
	readonly listToolName: string;
	readonly manToolName: string;
	/** Live, mutable view of every vehicle's own managed tools in this process -- refreshVehicleShellManagedTools
	 * keeps this current across a refreshVehicleToolAvailability call, since the per-turn decay
	 * handler and the man-page tool both close over this same handle rather than a stale snapshot. */
	managedTools: readonly VehicleShellManagedTool[];
	readonly coreOperationNames: ReadonlySet<string>;
	/** Starting TTL a core operation is (re-)seeded with -- kept on the handle so a later refresh
	 * can seed a core operation that just became available the same way initial registration did. */
	readonly coreTtlTurns: number;
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
 * syncManagedActiveTools requires. The two meta-tools are always included: they're a single,
 * process-wide capability now, never contingent on any one vehicle's own "did I win ownership"
 * check the way they used to be. */
function allManagedNames(handle: VehicleShellHandle): string[] {
	return [...handle.managedTools.map((tool) => tool.toolName), handle.listToolName, handle.manToolName];
}

/**
 * The active set a shell handle wants right now: its two meta-tools (always active), every
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
	return [...new Set([handle.listToolName, handle.manToolName, ...tracked])];
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

/** Splits a namespaced "<vehicle>:<operation>" name; undefined when name carries no vehicle prefix at all. */
function splitNamespacedName(name: string): { vehicleName: string; operationName: string } | undefined {
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

function createToolsListTool(listToolName: string, manToolName: string): ToolDefinition {
	return {
		name: listToolName,
		label: "List Tools",
		description: `Lists every registered Vehicle's own operations, one line each, namespaced "<vehicle>:<operation>" (e.g. "papyrus:tasks.create"). Optionally filter by a keyword matched against the name and description. Use ${manToolName} on a name from this list (or any name you already know) to see its full parameters and make it callable.`,
		parameters: Type.Object({
			query: Type.Optional(
				Type.String({ description: "Keyword to filter by (matched against operation name and description); omit to list everything." }),
			),
		}),
		async execute(_toolCallId, params) {
			const query = (params as { query?: string }).query ?? "";
			reportToolsListExecute("vehicle", query);
			const vehicles = await discoverAllVehicles();
			const operations = await namespacedOperationsOf(vehicles);
			const matches = operations
				.flatMap((descriptor, index) => {
					const score = shellQueryScore(descriptor, query);
					return score === undefined ? [] : [{ descriptor, index, score }];
				})
				.sort((left, right) => left.score - right.score || left.index - right.index)
				.map((entry) => entry.descriptor);
			const text =
				matches.length === 0
					? `No operations matched "${query}".`
					: matches.map((descriptor) => formatOperationOneLiner(descriptor)).join("\n");
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
			// and bare-name resolution across every vehicle.
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

					const managed = byKey.get(fullName);
					if (managed) {
						if (!managed.available) return `${fullName}: currently unavailable (${manToolName} cannot activate it right now).`;
						if (managed.blocked) return `${fullName}: blocked by the current safety policy -- not activatable.`;
						handle.tracker.seed(managed.toolName, discoveredTtlTurns);
						return `${formatOperationManPage(namespaced, managed.toolName)}\n\n(now callable as ${managed.toolName})`;
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
					return `${formatOperationManPage(namespaced, toolName)}\n\n(now callable as ${toolName})`;
				}),
			);
			applyShellActivation(pi, handle);
			return { content: [{ type: "text", text: pages.join("\n\n---\n\n") }], details: {} };
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
	const handle: VehicleShellHandle = {
		tracker: new VehicleShellTtlTracker(),
		listToolName,
		manToolName,
		managedTools: [],
		coreOperationNames: new Set(),
		coreTtlTurns: options.coreTtlTurns ?? DEFAULT_CORE_TTL_TURNS,
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
		pi.registerTool(createToolsListTool(listToolName, manToolName));
		pi.registerTool(createToolsManTool(pi, listToolName, manToolName, handle, options.discoveredTtlTurns ?? DEFAULT_DISCOVERED_TTL_TURNS));
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
