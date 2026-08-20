/**
 * Handle lifecycle/registration bootstrap -- the process-wide singleton and its public
 * registerVehicleShell/applyVehicleShellActivation entry points. Split out of vehicle-shell.ts's
 * own bundled concerns.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createAgentNotifier, frameAsBackgroundNotification } from "../agent-poll-ticker.js";
import { reportModuleLoad, reportShellRegistered } from "../client-diagnostics.js";
import { tryExtensionRuntimeAction } from "../pi-tool-availability.js";
import {
	__resetVehicleShellReregistrationFlagForTests,
	markVehicleShellNeedsReregistration,
	vehicleShellNeedsReregistration,
} from "./reregistration.js";
import {
	computeToolContextBudget,
	DEFAULT_BUDGET_FRACTION_OF_REMAINING,
	DEFAULT_FALLBACK_BUDGET_TOKENS,
	DEFAULT_MAX_TOOL_BUDGET_TOKENS,
	DEFAULT_MIN_TOOL_BUDGET_TOKENS,
} from "./context-budget.js";
import {
	applyShellActivation,
	DEFAULT_AGGREGATE_CACHE_TTL_MS,
	DEFAULT_CORE_TTL_TURNS,
	DEFAULT_DISCOVERED_TTL_TURNS,
	DEFAULT_LIST_TOOL_NAME,
	DEFAULT_MAN_TOOL_NAME,
	DEFAULT_TYPE_TOOL_NAME,
	recordToolboxReminderTransitions,
	refreshVehicleShellManagedTools,
	type VehicleShellHandle,
	type VehicleShellManagedTool,
	type VehicleShellOptions,
} from "./state.js";
import { buildToolboxReminderMessage, ToolboxReminderTracker } from "./toolbox-reminder.js";
import { createToolsListTool, createToolsManTool, createToolsTypeTool } from "./tools.js";
import { WeightedLruTracker } from "./weighted-lru.js";
import { markSharedRegistration } from "../shared-registration-marker.js";

/**
 * Maps the two deprecated flat TTL fields onto a scale factor for the budget bounds -- see
 * coreTtlTurns's own doc comment (state.ts) for why the budget, not WeightedLruTracker's own
 * call-credit constant (that only affects priority's absolute magnitude, never relative eviction
 * order within one tracker -- no observable effect a consumer could actually feel). A bigger
 * configured TTL meant "I want more things to stay resident" before; a proportionally bigger
 * budget is the direct, honestly-observable equivalent under real pressure. A consumer at the
 * exact defaults (the overwhelming majority today, confirmed via a workspace-wide grep) gets
 * scale factor 1, i.e. every DEFAULT_* budget constant unchanged.
 */
function legacyTtlBudgetScaleFactor(options: VehicleShellOptions): number {
	const legacy = (options.coreTtlTurns ?? DEFAULT_CORE_TTL_TURNS) + (options.discoveredTtlTurns ?? DEFAULT_DISCOVERED_TTL_TURNS);
	const defaults = DEFAULT_CORE_TTL_TURNS + DEFAULT_DISCOVERED_TTL_TURNS;
	return legacy / defaults;
}

reportModuleLoad(import.meta.url);

const SHELL_HANDLE_KEY = Symbol.for("vehicle.shell.handle@1");

/**
 * Marks the shared handle as needing re-registration next time ensureVehicleShellHandle runs,
 * WITHOUT touching pi.getAllTools() -- see ensureVehicleShellHandle's own doc comment for why a
 * live tool-presence probe races against Pi's real multi-extension load order (confirmed live: a
 * second, genuinely-concurrent extension's own first-ever registration attempt can run before the
 * first extension's own pi.registerTool() calls are visible in pi.getAllTools() yet, which made a
 * presence-based check misfire as "needs re-registration" and re-attempt pi.registerTool() for an
 * already-in-flight tool name -- a real, Pi-enforced conflict, not a reload at all).
 * session_shutdown is Pi's own authoritative signal for "this extension instance's own
 * registrations are about to be torn down" (reload, a session switch/new/resume/fork all funnel
 * through it per extensions.md) -- reacting to that event directly, instead of inferring it from
 * tool-list contents, can never race with concurrent first-time extension loading.
 */
function armReregistrationDetection(pi: ExtensionAPI): void {
	pi.on("session_shutdown", () => {
		markVehicleShellNeedsReregistration();
	});
}

/**
 * Registers the two/three meta-tools plus the tool_execution_end/turn_end listeners a shell
 * handle needs to actually function, against whichever ExtensionAPI is calling right now.
 *
 * Split out of ensureVehicleShellHandle so it can run in TWO situations, not just handle creation:
 * a brand-new handle, and an existing handle (surfaced from a *previous* extension instance) whose
 * own registrations were torn down by a `/reload` -- see ensureVehicleShellHandle's own doc
 * comment for why those are genuinely different conditions, not the same thing.
 */
function registerShellToolsAndListeners(pi: ExtensionAPI, handle: VehicleShellHandle, claimedElsewhere: boolean): void {
	reportShellRegistered("vehicle", handle.listToolName, handle.manToolName, !claimedElsewhere);
	if (!claimedElsewhere) {
		pi.registerTool(markSharedRegistration(createToolsListTool(handle.listToolName, handle.manToolName, handle)));
		pi.registerTool(markSharedRegistration(createToolsManTool(pi, handle.listToolName, handle.manToolName, handle)));
		pi.registerTool(markSharedRegistration(createToolsTypeTool(handle.listToolName, handle.manToolName, handle.typeToolName, handle)));
	}

	pi.on("tool_execution_end", (event) => {
		const toolName = (event as { toolName?: unknown }).toolName;
		if (typeof toolName === "string") handle.tracker.recordCall(toolName);
	});
	// The real Phase 3 wiring: ctx.getContextUsage() is a genuine, already-exported Pi SDK API,
	// reachable from this same handler signature all along -- it was simply never read before this.
	pi.on("turn_end", (_event, ctx) => {
		const budget = computeToolContextBudget(ctx.getContextUsage(), handle.budgetOptions, handle.lastKnownBudgetTokens);
		handle.lastKnownBudgetTokens = budget;
		const { evicted } = handle.tracker.evictToBudget(budget);
		recordToolboxReminderTransitions(handle, evicted);
		applyShellActivation(pi, handle);
		if (handle.toolboxReminderEnabled) {
			const { due } = handle.toolboxReminder.tick();
			if (due.length > 0) {
				const message = frameAsBackgroundNotification(buildToolboxReminderMessage(due, handle.manToolName));
				createAgentNotifier(pi).sendUserMessage(message, { deliverAs: "followUp" });
			}
		}
	});
}

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
 * meta-tools are registered here, exactly once per live registration, bound to nothing
 * vehicle-specific -- their own closures always read every vehicle currently in the process
 * (discoverAllVehicles), never one particular vehicle's own manifest.
 *
 * Real incident: `globalThis` survives a `/reload` (it's process-wide, not tied to any one
 * extension instance), but pi's own reload flow "reloads and rebinds extensions" -- every
 * pi.registerTool()/pi.on() call the OLD extension instance made is gone once the new instance's
 * own registration code runs. Naively treating "the handle object already exists" as "the tools
 * and listeners are still live" (this function's own behavior before this fix) meant Vehicle
 * Shell's entire tools_list/tools_man/tools_type surface -- and its recordCall/evictToBudget event
 * wiring -- silently vanished process-wide after ANY /reload, for every vehicle, until a full
 * process restart. Confirmed live: reloading after a vehicle-client-pi upgrade left tools_list and
 * tools_man both reporting "Tool ... not found" while flat, non-shell tools kept working fine.
 *
 * Every call here now checks vehicleShellNeedsReregistration() (armed via session_shutdown, see
 * armReregistrationDetection) and re-registers against the SAME shared handle (preserving its
 * accumulated tracker/budget state -- real history, not something to discard) when a reload
 * genuinely happened. Deliberately NOT a pi.getAllTools() presence probe (an earlier version of
 * this fix used one, and it raced against real multi-extension load order: a second, genuinely
 * concurrent extension's own first-ever registration can run before the first extension's own
 * pi.registerTool() calls are visible in pi.getAllTools() yet, misfiring as "needs
 * re-registration" and re-attempting pi.registerTool() for an already-in-flight tool name -- a
 * real, Pi-enforced "Tool ... conflicts with ..." load failure, confirmed live against
 * vehicle-pi-real-separate-extensions.test.ts's own two-genuinely-separate-extension-files
 * topology). session_shutdown is Pi's own authoritative signal for "this extension instance's
 * registrations are about to be torn down" and can never race with first-time loading that way.
 */
function ensureVehicleShellHandle(pi: ExtensionAPI, options: VehicleShellOptions): VehicleShellHandle {
	const holder = globalThis as { [SHELL_HANDLE_KEY]?: VehicleShellHandle };
	const existing = holder[SHELL_HANDLE_KEY];
	if (existing) {
		if (vehicleShellNeedsReregistration()) registerShellToolsAndListeners(pi, existing, /* claimedElsewhere */ false);
		armReregistrationDetection(pi);
		return existing;
	}

	const listToolName = options.listToolName ?? DEFAULT_LIST_TOOL_NAME;
	const manToolName = options.manToolName ?? DEFAULT_MAN_TOOL_NAME;
	const typeToolName = options.typeToolName ?? DEFAULT_TYPE_TOOL_NAME;
	const legacyScale = legacyTtlBudgetScaleFactor(options);
	const budgetOptions = {
		minToolBudgetTokens: options.budget?.minToolBudgetTokens ?? DEFAULT_MIN_TOOL_BUDGET_TOKENS * legacyScale,
		maxToolBudgetTokens: options.budget?.maxToolBudgetTokens ?? DEFAULT_MAX_TOOL_BUDGET_TOKENS * legacyScale,
		fractionOfRemaining: options.budget?.fractionOfRemaining ?? DEFAULT_BUDGET_FRACTION_OF_REMAINING * legacyScale,
	};
	const handle: VehicleShellHandle = {
		tracker: new WeightedLruTracker(),
		toolboxReminder: new ToolboxReminderTracker(options.toolboxReminder),
		toolboxReminderEnabled: options.toolboxReminder?.enabled ?? true,
		listToolName,
		manToolName,
		typeToolName,
		managedTools: [],
		coreOperationNames: new Set(),
		aggregateCacheTtlMs: options.aggregateCacheTtlMs ?? DEFAULT_AGGREGATE_CACHE_TTL_MS,
		lastKnownBudgetTokens: options.budget?.fallbackBudgetTokens ?? DEFAULT_FALLBACK_BUDGET_TOKENS * legacyScale,
		budgetOptions,
	};
	holder[SHELL_HANDLE_KEY] = handle;

	// Distinct from "did another vehicle already claim it" (that concern doesn't exist anymore --
	// every vehicle just folds into this one shared handle) -- this guards against a truly
	// unrelated extension elsewhere in the process having registered a same-named tool of its own.
	// Pi has no unregisterTool(), so registering a second, permanently-unreachable copy would be
	// pure dead weight; skip it, but still track/decay our own operations exactly as normal.
	const runtime = tryExtensionRuntimeAction(() => pi.getAllTools());
	const claimedElsewhere = runtime.status === "ready" && runtime.value.some((tool) => tool.name === listToolName);
	registerShellToolsAndListeners(pi, handle, claimedElsewhere);
	armReregistrationDetection(pi);

	return handle;
}

/** Test-only: clears the process-wide shell handle singleton (and its own reload-detection flag)
 * so each test gets a fresh one. Not exported from the package's own public entry point. */
export function __resetVehicleShellHandleForTests(): void {
	delete (globalThis as { [SHELL_HANDLE_KEY]?: VehicleShellHandle })[SHELL_HANDLE_KEY];
	__resetVehicleShellReregistrationFlagForTests();
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
