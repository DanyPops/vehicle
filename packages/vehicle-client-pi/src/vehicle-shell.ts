import type { JsonSchema, VehicleManifest, VehicleOperationDescriptor } from "@danypops/vehicle-core";
import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { syncManagedActiveTools } from "./pi-tool-availability.js";
import { type DiscoveredVehicle, discoverForeignVehicles } from "./vehicle-shell-broker.js";

/**
 * A decaying-TTL cache over Pi's active-tool set, turn-scoped. Every tracked tool name carries a
 * current and a starting TTL (in turns); a tool actually called during a turn is refreshed back to
 * its own starting value, everything else decrements by one -- reaching zero evicts it (removed
 * from the tracker; the underlying Pi tool stays registered, just inactive until re-seeded).
 *
 * Deliberately name-keyed and Pi-agnostic: this file never touches ExtensionAPI directly, so its
 * decay/refresh logic is testable as a pure state machine.
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
export function formatOperationOneLiner(descriptor: VehicleOperationDescriptor): string {
	return `${descriptor.name} -- ${descriptor.description}`;
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
 * activatable -- deliberately narrower than vehicle-pi.ts's own RegisteredPiVehicleTool so this
 * file never has to import from (and create a cycle with) vehicle-pi.ts. */
export interface VehicleShellManagedTool {
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
	/** Pi tool name for the list meta-tool. Default "tools_list". */
	readonly listToolName?: string;
	/** Pi tool name for the man meta-tool. Default "tools_man". */
	readonly manToolName?: string;
	/**
	 * Opt-in broker mode: when given, tools_list/tools_man also discover and list every OTHER
	 * live Vehicle daemon's own operations (namespaced "<vehicleName>:<operation>"), scanning the
	 * shared Vehicle Handle Directory (see @danypops/vehicle-server's resolveSharedVehicleHandleDirectory).
	 * Omitted preserves today's exact single-vehicle behavior. Discovery failure never breaks this
	 * Vehicle's own base tools_list/tools_man behavior -- it degrades to exactly that.
	 */
	readonly broker?: VehicleShellBrokerOptions;
}

export interface VehicleShellBrokerOptions {
	/** This Vehicle's own stable identity name (Armada's own VehicleName pattern), excluded from its own discovery results. */
	readonly ownVehicleName: string;
	/** Injectable for tests; defaults to a real discoverForeignVehicles(ownVehicleName) call. */
	readonly discover?: () => Promise<readonly DiscoveredVehicle[]>;
}

export interface VehicleShellHandle {
	readonly tracker: VehicleShellTtlTracker;
	readonly listToolName: string;
	readonly manToolName: string;
	/** Live, mutable view of this Vehicle's own managed tools -- refreshVehicleShellManagedTools
	 * keeps this current across a refreshVehicleToolAvailability call, since the per-turn decay
	 * handler and the man-page tool both close over this same handle rather than a stale snapshot. */
	managedTools: readonly VehicleShellManagedTool[];
	readonly coreOperationNames: ReadonlySet<string>;
	/** Starting TTL a core operation is (re-)seeded with -- kept on the handle so a later refresh
	 * can seed a core operation that just became available the same way initial registration did. */
	readonly coreTtlTurns: number;
}

/**
 * Updates a handle's managed-tool bookkeeping after a fresh availability check (e.g. a credential
 * became available, or a /safety override changed). A core operation that just became available
 * and isn't currently tracked is (re-)seeded fresh, matching what initial registration would have
 * done for it -- every other tracked tool (core or discovered) is left exactly as the decay cycle
 * already has it; "core" only ever means "seeded generously," never "exempt from decay" (see
 * desiredShellActiveNames, which reads tracker membership alone, not coreOperationNames, for who's
 * currently active).
 */
export function refreshVehicleShellManagedTools(handle: VehicleShellHandle, managedTools: readonly VehicleShellManagedTool[]): void {
	handle.managedTools = managedTools;
	for (const tool of managedTools) {
		if (handle.coreOperationNames.has(tool.operationName) && tool.available && !tool.blocked && !handle.tracker.isTracked(tool.toolName)) {
			handle.tracker.seed(tool.toolName, handle.coreTtlTurns);
		}
	}
}

/** Every Pi tool name this handle could ever legitimately activate -- the full `managed` superset syncManagedActiveTools requires. */
function allManagedNames(handle: VehicleShellHandle): string[] {
	return [...handle.managedTools.map((tool) => tool.toolName), handle.listToolName, handle.manToolName];
}

/**
 * The active set a shell handle wants right now: its two meta-tools (always active), its core
 * operations that are currently available and unblocked, and whatever tools_man has activated
 * that hasn't yet decayed out -- re-filtered against current availability so a tool that became
 * unavailable/blocked since it was seeded doesn't stay active just because its TTL hasn't hit zero.
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

/** A foreign vehicle's own descriptor, relabeled with its namespaced "<vehicleName>:<operation>"
 * name for listing/matching -- a shallow clone, never mutates the original manifest. */
function namespacedDescriptor(vehicleName: string, descriptor: VehicleOperationDescriptor): VehicleOperationDescriptor {
	return { ...descriptor, name: `${vehicleName}:${descriptor.name}` };
}

async function discoverBrokerOperations(broker: VehicleShellBrokerOptions | undefined): Promise<readonly VehicleOperationDescriptor[]> {
	if (!broker) return [];
	try {
		const discover = broker.discover ?? (() => discoverForeignVehicles(broker.ownVehicleName));
		const foreign = await discover();
		return foreign.flatMap((vehicle) => vehicle.manifest.operations.map((op) => namespacedDescriptor(vehicle.name, op)));
	} catch {
		// Broker discovery must never break this Vehicle's own base tools_list/tools_man behavior.
		return [];
	}
}

function createToolsListTool(listToolName: string, manifest: VehicleManifest, broker?: VehicleShellBrokerOptions): ToolDefinition {
	return {
		name: listToolName,
		label: "List Tools",
		description: `Lists ${manifest.name}'s available operations by name, one line each (name -- description).${broker ? ' Also lists every other live Vehicle daemon\'s own operations, namespaced "<vehicle>:<operation>".' : ""} Optionally filter by a keyword matched against the name and description. Use ${DEFAULT_MAN_TOOL_NAME} on a name from this list (or any name you already know) to see its full parameters and make it callable.`,
		parameters: Type.Object({
			query: Type.Optional(
				Type.String({ description: "Keyword to filter by (matched against operation name and description); omit to list everything." }),
			),
		}),
		async execute(_toolCallId, params) {
			const query = (params as { query?: string }).query ?? "";
			const operations = [...manifest.operations, ...(await discoverBrokerOperations(broker))];
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
	manToolName: string,
	manifest: VehicleManifest,
	handle: VehicleShellHandle,
	discoveredTtlTurns: number,
	broker?: VehicleShellBrokerOptions,
): ToolDefinition {
	return {
		name: manToolName,
		label: "Tool Manual",
		description: `Shows full documentation for one or more of ${manifest.name}'s operations by exact name (as seen from ${DEFAULT_LIST_TOOL_NAME} or already known) and makes each one callable starting next turn. A name doesn't need to have been listed first.`,
		parameters: Type.Object({
			names: Type.Array(Type.String(), { description: 'Exact operation name(s), e.g. "tasks.create".', minItems: 1 }),
		}),
		async execute(_toolCallId, params) {
			const names = (params as { names: string[] }).names;
			const byOperationName = new Map(handle.managedTools.map((tool) => [tool.operationName, tool]));
			// Only resolved once, lazily, and only if at least one requested name isn't local -- a
			// broker discovery round-trip is real network/fs work, never paid for a purely-local request.
			let foreignOperations: readonly VehicleOperationDescriptor[] | undefined;
			const pages = await Promise.all(
				names.map(async (name) => {
					const descriptor = manifest.operations.find((op) => op.name === name);
					const managed = byOperationName.get(name);
					if (descriptor && managed) {
						if (!managed.available) return `${name}: currently unavailable (${DEFAULT_MAN_TOOL_NAME} cannot activate it right now).`;
						if (managed.blocked) return `${name}: blocked by the current safety policy -- not activatable.`;
						handle.tracker.seed(managed.toolName, discoveredTtlTurns);
						return `${formatOperationManPage(descriptor, managed.toolName)}\n\n(now callable as ${managed.toolName})`;
					}
					foreignOperations ??= await discoverBrokerOperations(broker);
					const foreignDescriptor = foreignOperations.find((op) => op.name === name);
					if (foreignDescriptor) {
						const vehicleName = name.slice(0, name.indexOf(":"));
						return `${name}: known -- provided by Vehicle "${vehicleName}", discovered live via broker mode. Foreign-vehicle activation isn't wired yet; not yet callable here.`;
					}
					return `${name}: no such operation. Use ${DEFAULT_LIST_TOOL_NAME} to browse available names.`;
				}),
			);
			applyShellActivation(pi, handle);
			return { content: [{ type: "text", text: pages.join("\n\n---\n\n") }], details: {} };
		},
	};
}

/**
 * Registers the two always-on meta-tools (tools_list, tools_man) and wires the decaying-TTL
 * activation cycle: a core operation (per options.coreOperations) boots active; every other
 * operation boots inactive, reachable via tools_man; each turn, unused active tools decay and
 * eventually get deactivated (not unregistered -- Pi has no unregisterTool()), while a tool
 * actually called that turn stays fully warm. Returns undefined (no-op, today's all-active
 * behavior applies) when options is omitted -- opt-in only, per this package's own convention for
 * a change that could alter an existing consumer's visible tool surface.
 */
export function registerVehicleShell(
	pi: ExtensionAPI,
	manifest: VehicleManifest,
	managedTools: readonly VehicleShellManagedTool[],
	options: VehicleShellOptions | undefined,
): VehicleShellHandle | undefined {
	if (!options) return undefined;
	const discoveredTtlTurns = options.discoveredTtlTurns ?? DEFAULT_DISCOVERED_TTL_TURNS;
	const handle: VehicleShellHandle = {
		tracker: new VehicleShellTtlTracker(),
		listToolName: options.listToolName ?? DEFAULT_LIST_TOOL_NAME,
		manToolName: options.manToolName ?? DEFAULT_MAN_TOOL_NAME,
		managedTools,
		coreOperationNames: new Set(options.coreOperations ?? []),
		coreTtlTurns: options.coreTtlTurns ?? DEFAULT_CORE_TTL_TURNS,
	};

	for (const tool of managedTools) {
		if (handle.coreOperationNames.has(tool.operationName) && tool.available && !tool.blocked)
			handle.tracker.seed(tool.toolName, handle.coreTtlTurns);
	}

	pi.registerTool(createToolsListTool(handle.listToolName, manifest, options.broker));
	pi.registerTool(createToolsManTool(pi, handle.manToolName, manifest, handle, discoveredTtlTurns, options.broker));

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

/** Applies (or re-applies, e.g. once the runtime is ready after session_start) the shell's
 * current desired active set -- the shell-mode counterpart of registerVehicleTools' own
 * syncAvailability closure for the non-shell path. */
export function applyVehicleShellActivation(pi: ExtensionAPI, handle: VehicleShellHandle): void {
	applyShellActivation(pi, handle);
}
