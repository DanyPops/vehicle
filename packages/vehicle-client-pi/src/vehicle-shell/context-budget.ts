/**
 * A stretchable token budget for the Vehicle Shell's own active-tool set -- Phase 3 of the design
 * that replaces VehicleShellTtlTracker's fixed-turn-count decay (see that file's own doc comment).
 * Pure function over Pi's own ContextUsage shape, no ExtensionAPI dependency -- same testability
 * discipline as the rest of vehicle-shell/*.
 */

/** The subset of Pi's own ContextUsage this function needs -- deliberately narrower than the real
 * SDK type (percent is display-only, never needed for the budget computation itself). */
export interface ContextBudgetUsage {
	/** null right after compaction, before the next LLM response reports real usage. */
	readonly tokens: number | null;
	readonly contextWindow: number;
}

export interface ContextBudgetOptions {
	/** Floor, in tokens -- even a nearly-full conversation still keeps at least this much room for
	 * the shell's own meta-tools plus whatever core operations are active. */
	readonly minToolBudgetTokens: number;
	/** Ceiling, in tokens -- an empty conversation (huge remaining room) still never claims more
	 * than this share for tool schemas alone. */
	readonly maxToolBudgetTokens: number;
	/** What fraction of the model's own remaining room (contextWindow - tokens) the shell may
	 * claim, before clamping to [minToolBudgetTokens, maxToolBudgetTokens]. */
	readonly fractionOfRemaining: number;
}

export function clampToBudgetBounds(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/**
 * The current tool-context budget, in tokens: `clamp((contextWindow - tokens) *
 * fractionOfRemaining, min, max)` -- more room when the conversation is short, less as it fills
 * up, always bounded so neither extreme (an empty conversation, a nearly-full one) produces a
 * degenerate result.
 *
 * `usage` is undefined, or its own `tokens` is null (e.g. right after compaction, before the next
 * LLM response), falls back to `fallbackBudgetTokens` -- clamped the same way, so a caller can
 * pass its own last known real budget (preferred: reuse whatever was actually computed most
 * recently) or a safe static default (no real reading has ever arrived yet) without this function
 * needing to know which. Never throws, never returns something outside [min, max].
 */
export function computeToolContextBudget(
	usage: ContextBudgetUsage | undefined,
	options: ContextBudgetOptions,
	fallbackBudgetTokens: number,
): number {
	if (!usage || usage.tokens === null) {
		return clampToBudgetBounds(fallbackBudgetTokens, options.minToolBudgetTokens, options.maxToolBudgetTokens);
	}
	const remaining = Math.max(0, usage.contextWindow - usage.tokens);
	return clampToBudgetBounds(remaining * options.fractionOfRemaining, options.minToolBudgetTokens, options.maxToolBudgetTokens);
}

/** Illustrative starting points, not load-bearing constants -- tune from real usage, exactly like
 * DEFAULT_CORE_TTL_TURNS/DEFAULT_DISCOVERED_TTL_TURNS in state.ts. */
export const DEFAULT_MIN_TOOL_BUDGET_TOKENS = 2_000;
export const DEFAULT_MAX_TOOL_BUDGET_TOKENS = 40_000;
export const DEFAULT_BUDGET_FRACTION_OF_REMAINING = 0.2;
/** Used when getContextUsage() has never returned a real reading at all (no prior turn to fall
 * back on either) -- generous enough that a fresh session's very first turn_end isn't needlessly
 * restrictive before any real usage signal exists. */
export const DEFAULT_FALLBACK_BUDGET_TOKENS = 8_000;
