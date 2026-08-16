/**
 * The Vehicle Shell: an apropos/whatis/man-inspired discovery layer over registered Vehicle
 * operations (tools_list/tools_man/tools_type), plus the process-wide, decaying-TTL active-tool
 * set that keeps a large operation surface from permanently occupying Pi's own tool budget.
 * Composition root only -- see vehicle-shell/* for the real collaborators (TTL tracking,
 * man-page/query formatting, handle/state management, namespaced-name resolution, the 3 dynamic
 * tool factories, and registration bootstrap).
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
	refreshVehicleShellManagedTools,
	type VehicleShellHandle,
	type VehicleShellManagedTool,
	type VehicleShellOptions,
} from "./vehicle-shell/state.js";
export { estimateToolWeightTokens, type ToolWeightInput } from "./vehicle-shell/tool-weight.js";
export { VehicleShellTtlTracker } from "./vehicle-shell/ttl-tracker.js";
export { type WeightedLruSnapshotEntry, WeightedLruTracker } from "./vehicle-shell/weighted-lru.js";
