/**
 * The Vehicle Shell: an apropos/whatis/man-inspired discovery layer over registered Vehicle
 * operations (tools_list/tools_man/tools_type), plus the process-wide, weighted-LRU active-tool
 * set -- bounded by a stretchable token budget derived from the model's own remaining context
 * room (ctx.getContextUsage()), not a fixed turn count -- that keeps a large operation surface
 * from permanently occupying Pi's own tool budget. Each active tool's own estimated context cost
 * (tool-weight.ts) dampens how much priority credit it earns per call (weighted-lru.ts), so a
 * heavy, rarely-used tool naturally cycles out under real pressure before a light, frequently-used
 * one -- and nothing is evicted at all unless the active set's total weight actually exceeds the
 * current budget (context-budget.ts). Composition root only -- see vehicle-shell/* for the real
 * collaborators (tool-weight estimation, weighted-LRU eviction, budget computation, man-page/query
 * formatting, handle/state management, namespaced-name resolution, the 3 dynamic tool factories,
 * and registration bootstrap). VehicleShellTtlTracker (ttl-tracker.ts) is the superseded
 * fixed-turn-count mechanism this replaced -- kept exported (deprecated) for any external consumer
 * still using it directly as a standalone utility, but no longer wired into this file's own
 * runtime.
 */

export { __resetVehicleShellHandleForTests, applyVehicleShellActivation, registerVehicleShell } from "./vehicle-shell/bootstrap.js";
export {
	compileShellQueryRegex,
	formatOperationManPage,
	formatOperationOneLiner,
	matchesShellQuery,
	relatedOperationNames,
	type ShellQueryScope,
} from "./vehicle-shell/formatting.js";
export {
	classifyOperationName,
	formatOperationTypeLine,
	type OperationNameResolution,
	type OperationTypeResult,
	resolveOperationName,
	splitNamespacedName,
} from "./vehicle-shell/name-resolution.js";
export {
	DEFAULT_AGGREGATE_CACHE_TTL_MS,
	desiredShellActiveNames,
	recordToolboxReminderTransitions,
	refreshVehicleShellManagedTools,
	type VehicleShellHandle,
	type VehicleShellManagedTool,
	type VehicleShellOptions,
} from "./vehicle-shell/state.js";
export { estimateToolWeightTokens, type ToolWeightInput } from "./vehicle-shell/tool-weight.js";
export {
	buildToolboxReminderMessage,
	DEFAULT_MAX_TRACKED_TOOLBOX_REMINDER_CANDIDATES,
	DEFAULT_MIN_MS_SINCE_INACTIVE,
	DEFAULT_MIN_TURNS_SINCE_INACTIVE,
	type ToolboxReminderCandidate,
	type ToolboxReminderOptions,
	ToolboxReminderTracker,
} from "./vehicle-shell/toolbox-reminder.js";
export { VehicleShellTtlTracker } from "./vehicle-shell/ttl-tracker.js";
export {
	reportableVehiclesByName,
	reportShellToolUsage,
	reportShellToolUsageToAllDiscovered,
	safeReportShellToolUsage,
	type ReportableVehicle,
	type ShellMetaToolName,
} from "./vehicle-shell/usage-reporting.js";
export { type WeightedLruSnapshotEntry, WeightedLruTracker } from "./vehicle-shell/weighted-lru.js";
