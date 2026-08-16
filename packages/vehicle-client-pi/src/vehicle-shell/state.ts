/**
 * Shell handle/state management -- the VehicleShellHandle every collaborator closes over, its
 * options, cross-vehicle discovery, and tools_list's own opt-in aggregate cache. Split out of
 * vehicle-shell.ts's own bundled concerns.
 */

import type { VehicleManifestOperation } from "@danypops/vehicle-core";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { syncManagedActiveTools } from "../pi-tool-availability.js";
import type { DiscoveredVehicle } from "../vehicle-shell-broker.js";
import { type InProcessDiscoveredVehicle, listInProcessVehicles } from "../vehicle-shell-registry.js";
import type { ContextBudgetOptions } from "./context-budget.js";
import type { WeightedLruTracker } from "./weighted-lru.js";

export const DEFAULT_LIST_TOOL_NAME = "tools_list";
export const DEFAULT_MAN_TOOL_NAME = "tools_man";
export const DEFAULT_TYPE_TOOL_NAME = "tools_type";
/**
 * No longer literally interpreted as a turn count (see VehicleShellOptions.coreTtlTurns's own
 * @deprecated doc comment) -- these two constants now serve only as the baseline
 * `coreTtlTurns + discoveredTtlTurns` sum that bootstrap.ts's legacyTtlBudgetScaleFactor compares
 * a deprecated-field consumer's own values against, so their sum staying at 28 is load-bearing for
 * that mapping even though each value's own original "turns before decay" meaning is gone.
 * Historical values, kept for the scale-factor baseline: tuned up from an initial 10/3 when this
 * was still a real turn count -- a discovered tool decaying in 3 unused turns proved too
 * aggressive in practice, forcing a needless repeat tools_man round-trip on a tool the agent had
 * already activated moments earlier.
 */
export const DEFAULT_CORE_TTL_TURNS = 20;
export const DEFAULT_DISCOVERED_TTL_TURNS = 8;

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
	/** This tool's own estimated context cost, in tokens (tool-weight.ts's estimateToolWeightTokens,
	 * computed once from its real ToolDefinition at registration time) -- optional so a hand-built
	 * test fixture never has to supply one; refreshVehicleShellManagedTools falls back to
	 * FALLBACK_TOOL_WEIGHT_TOKENS when absent. Every real caller (shellManagedTools in
	 * tool-creation.ts) always supplies the genuine computed value. */
	readonly weightTokens?: number;
}

/** Used only when a VehicleShellManagedTool arrives with no real weightTokens (a hand-built test
 * fixture, never a real registration) -- small and safe rather than accidentally dominating the
 * budget for something whose true cost was never actually measured. */
export const FALLBACK_TOOL_WEIGHT_TOKENS = 50;

export interface VehicleShellOptions {
	/** Operation names (VehicleOperationDescriptor.name, e.g. "tasks.create") that boot active,
	 * needing no tools_man call. Everything else boots inactive, reachable only via tools_man.
	 * Domain-agnostic on purpose -- this package never names a specific consumer's operations; the
	 * consumer supplies its own list. */
	readonly coreOperations?: readonly string[];
	/**
	 * @deprecated Superseded by the weighted-LRU + stretchable budget model (see `budget` below) --
	 * eviction is no longer a fixed turn count, it's real context pressure. Still honored, not a
	 * silent no-op: this value (combined with discoveredTtlTurns the same way), relative to
	 * DEFAULT_CORE_TTL_TURNS+DEFAULT_DISCOVERED_TTL_TURNS, scales every budget bound
	 * (min/max/fractionOfRemaining/fallback) proportionally, unless `budget` is also given
	 * explicitly (which always wins outright) -- a more generous legacy TTL meant "I want more
	 * things to stay resident" before, and a proportionally bigger budget is the direct,
	 * honestly-observable equivalent under real pressure now. Prefer `budget` directly for new
	 * code; this mapping exists only so an existing consumer's options object keeps working (and
	 * keeps *some* real effect) unmodified. No consumer as of this migration actually customizes it
	 * (confirmed via a workspace-wide grep) -- the mapping only ever changes behavior for one that
	 * starts doing so, or already had, going forward.
	 */
	readonly coreTtlTurns?: number;
	/** @deprecated See coreTtlTurns's own doc comment -- combines with it into the same budget-scaling
	 * factor. */
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
	/**
	 * Overrides for the stretchable tool-context budget computed each turn_end from
	 * ctx.getContextUsage() -- see context-budget.ts's own computeToolContextBudget for exactly how
	 * these combine. Every field optional and independently overridable; an omitted field keeps its
	 * own DEFAULT_* constant from context-budget.ts. Illustrative starting points, not load-bearing
	 * constants -- tune from real usage, exactly like coreTtlTurns/discoveredTtlTurns before them.
	 */
	readonly budget?: {
		readonly minToolBudgetTokens?: number;
		readonly maxToolBudgetTokens?: number;
		readonly fractionOfRemaining?: number;
		/** Used only before the first real turn_end ever runs, or whenever getContextUsage() has
		 * never returned a real reading at all (no prior turn_end to fall back on either). */
		readonly fallbackBudgetTokens?: number;
	};
}

export interface VehicleShellHandle {
	readonly tracker: WeightedLruTracker;
	readonly listToolName: string;
	readonly manToolName: string;
	readonly typeToolName: string;
	/** Live, mutable view of every vehicle's own managed tools in this process -- refreshVehicleShellManagedTools
	 * keeps this current across a refreshVehicleToolAvailability call, since the per-turn eviction
	 * handler and the man-page tool both close over this same handle rather than a stale snapshot. */
	managedTools: readonly VehicleShellManagedTool[];
	readonly coreOperationNames: ReadonlySet<string>;
	/** tools_list's own aggregate cache TTL, in milliseconds -- see VehicleShellOptions.aggregateCacheTtlMs. */
	readonly aggregateCacheTtlMs: number;
	/** The tool-context budget (in tokens) computed at the end of the most recent turn -- reused as
	 * computeToolContextBudget's own fallback the next time ctx.getContextUsage() returns undefined
	 * (e.g. right after compaction), so a temporarily-unknown reading degrades to "whatever was true
	 * a moment ago" rather than a fixed guess. Starts at budgetOptions.fallbackBudgetTokens (or its
	 * own DEFAULT_FALLBACK_BUDGET_TOKENS) before the first real turn_end ever runs. */
	lastKnownBudgetTokens: number;
	/** Resolved (defaults-applied) budget bounds this handle's own turn_end handler passes to
	 * computeToolContextBudget -- see VehicleShellOptions.budget for the per-field override surface. */
	readonly budgetOptions: ContextBudgetOptions;
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
 * this vehicle's own or another's) is left exactly as the weighted-LRU tracker already has it;
 * "core" only ever means "seeded eagerly, at registration time," never "exempt from eviction" (see
 * desiredShellActiveNames, which reads tracker membership alone, not coreOperationNames, for who's
 * currently active).
 */
export function refreshVehicleShellManagedTools(handle: VehicleShellHandle, incoming: readonly VehicleShellManagedTool[]): void {
	const incomingToolNames = new Set(incoming.map((tool) => tool.toolName));
	handle.managedTools = [...handle.managedTools.filter((tool) => !incomingToolNames.has(tool.toolName)), ...incoming];
	for (const tool of incoming) {
		if (handle.coreOperationNames.has(tool.operationName) && tool.available && !tool.blocked && !handle.tracker.isTracked(tool.toolName)) {
			handle.tracker.seed(tool.toolName, tool.weightTokens ?? FALLBACK_TOOL_WEIGHT_TOKENS);
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
 * activated that hasn't yet been evicted under context pressure -- re-filtered against current
 * availability so a tool that became unavailable/blocked since it was seeded doesn't stay active
 * just because the weighted-LRU tracker itself hasn't evicted it.
 */
export function desiredShellActiveNames(handle: VehicleShellHandle): string[] {
	const byToolName = new Map(handle.managedTools.map((tool) => [tool.toolName, tool]));
	const tracked = handle.tracker.trackedNames().filter((toolName) => {
		const tool = byToolName.get(toolName);
		return tool?.available === true && !tool.blocked;
	});
	return [...new Set([handle.listToolName, handle.manToolName, handle.typeToolName, ...tracked])];
}

export function applyShellActivation(pi: ExtensionAPI, handle: VehicleShellHandle): void {
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
export async function discoverAllVehicles(): Promise<readonly (InProcessDiscoveredVehicle | DiscoveredVehicle)[]> {
	const inProcess = listInProcessVehicles();
	try {
		const { discoverForeignVehicles } = await import("../vehicle-shell-broker.js");
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
export async function namespacedOperationsOf(
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
export async function cachedAggregatedOperations(
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
