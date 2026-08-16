/**
 * Generic default rendering for any Vehicle-projected Pi tool, driven by the
 * operation's own descriptor metadata (effect, name) rather than requiring
 * every operation to hand-roll renderCall/renderResult. A consumer with real
 * UX investment in one operation still supplies its own pair through
 * RegisterVehicleToolsOptions.renderers -- this is the fallback, not the
 * only option.
 *
 * Composition root only -- see vehicle-render/{text-safety,call-rendering,result-rendering}.ts
 * for the real implementation, split along the exact same call-vs-result boundary Pi's own
 * ToolDefinition.renderCall/renderResult already draws.
 */

export { humanizeOperationName, pickIdentityArgument, type RenderCallContext, renderVehicleCall } from "./vehicle-render/call-rendering.js";
export { type RenderResultContext, renderVehicleResult, type VehiclePresenter } from "./vehicle-render/result-rendering.js";
export { neutralizeEmbeddedFullResets, truncateToWidth } from "./vehicle-render/text-safety.js";
