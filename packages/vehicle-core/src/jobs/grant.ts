/**
 * The Grant primitive's own wire-neutral shape: a resource budget bounding how much an
 * already-authorized, already-running long-running operation may still do before it must ask
 * for more. Mirrors VehicleJobWakeBudget's own convention (a plain, optional-per-dimension
 * object, not a class) -- see wake-log.ts's own doc comment for that precedent. Every dimension
 * is independently optional: a caller states only the ceilings that matter for its own operation
 * (an operation with no real notion of "tokens" simply never sets maxTokens).
 *
 * Deliberately agent-flavored (turns/tool-calls/tokens) rather than a generic {maxCount, maxBytes}
 * pair the way VehicleJobWakeBudget is -- Vehicle was built specifically for agent consumers
 * (vehicle-client-pi exists precisely to project operations as Pi tools), so this vocabulary
 * belongs here rather than being reinvented per-consumer.
 */
export interface VehicleGrantBudget {
	readonly maxTurns?: number;
	readonly maxToolCalls?: number;
	readonly maxTokens?: number;
	readonly maxWallClockMs?: number;
}

/**
 * True the moment any one *set* dimension reaches zero or below -- the tightest dimension
 * governs, not an average or a sum. A dimension the caller never set imposes no ceiling of its
 * own. An entirely empty budget ({}) is never exhausted: that's an unbounded grant (every
 * dimension omitted), not a zero one -- a caller that wants "no more of anything" states at
 * least one dimension as 0, it doesn't rely on {} meaning that.
 */
export function grantBudgetExhausted(remaining: VehicleGrantBudget): boolean {
	return (
		(remaining.maxTurns !== undefined && remaining.maxTurns <= 0) ||
		(remaining.maxToolCalls !== undefined && remaining.maxToolCalls <= 0) ||
		(remaining.maxTokens !== undefined && remaining.maxTokens <= 0) ||
		(remaining.maxWallClockMs !== undefined && remaining.maxWallClockMs <= 0)
	);
}

/**
 * Adds a top-up onto the current remaining budget, dimension by dimension. A dimension absent
 * from the top-up is left exactly as it was; a dimension the current budget never had but the
 * top-up introduces is taken as-is (not added to an implicit 0, since the current budget's own
 * "never set" already means unbounded for that dimension -- introducing a ceiling for the first
 * time via a top-up is a real, deliberate narrowing a caller must do explicitly, not an artifact
 * of the merge itself).
 */
export function mergeGrantBudget(current: VehicleGrantBudget, additional: VehicleGrantBudget): VehicleGrantBudget {
	const merged: { -readonly [K in keyof VehicleGrantBudget]?: number } = { ...current };
	for (const key of ["maxTurns", "maxToolCalls", "maxTokens", "maxWallClockMs"] as const) {
		const addition = additional[key];
		if (addition === undefined) continue;
		merged[key] = (current[key] ?? 0) + addition;
	}
	return merged;
}
