/**
 * Handle lifecycle/registration bootstrap -- the process-wide singleton and its public
 * registerVehicleShell/applyVehicleShellActivation entry points. Split out of vehicle-shell.ts's
 * own bundled concerns.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { reportModuleLoad, reportShellRegistered } from "../client-diagnostics.js";
import { tryExtensionRuntimeAction } from "../pi-tool-availability.js";
import {
	applyShellActivation,
	DEFAULT_AGGREGATE_CACHE_TTL_MS,
	DEFAULT_CORE_TTL_TURNS,
	DEFAULT_DISCOVERED_TTL_TURNS,
	DEFAULT_LIST_TOOL_NAME,
	DEFAULT_MAN_TOOL_NAME,
	DEFAULT_TYPE_TOOL_NAME,
	refreshVehicleShellManagedTools,
	type VehicleShellHandle,
	type VehicleShellManagedTool,
	type VehicleShellOptions,
} from "./state.js";
import { createToolsListTool, createToolsManTool, createToolsTypeTool } from "./tools.js";
import { VehicleShellTtlTracker } from "./ttl-tracker.js";

reportModuleLoad(import.meta.url);

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
