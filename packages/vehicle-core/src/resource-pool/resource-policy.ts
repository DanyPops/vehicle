/** Which ceiling actually constrained the most recent admission decision. */
export type ResourcePoolActiveCeilingSource = "configured" | "resource-budget" | "absolute-cap";

/**
 * Optional plug point letting a real resource budget (memory, /proc-sampled process cost, ...)
 * drive admission and retention decisions beyond the pool's own configured counts. A pool without
 * one falls back to its configured maxActive/absoluteMaxActive alone -- this interface exists so a
 * caller CAN plug in something smarter, not because every caller needs to.
 *
 * `Status` is left to the caller (default `unknown`) rather than fixed to one shape: the pool
 * itself never inspects or reshapes what `status()` returns, only forwards it verbatim in its own
 * status() report -- a caller with an existing status shape (its own field names, units, wire
 * contract) plugs it in unchanged, no adapter required.
 */
export interface ResourcePoolResourcePolicy<Status = unknown> {
	canAdmit(activePartitions: readonly string[], requestedPartition: string): boolean;
	isOverBudget(activePartitions: readonly string[]): boolean;
	/**
	 * A conservative, count-shaped ceiling derived from a real budget and worst-case known
	 * per-partition cost -- lets a larger real budget actually raise how many resources the pool
	 * will try to keep active, instead of a fixed configured count being the permanent bottleneck
	 * regardless of how much is genuinely available. Never authoritative on its own: canAdmit's own
	 * precise per-attempt check still gates the actual admission. Returns undefined on any metric
	 * loss -- fails closed, never treated as "unlimited room."
	 */
	softActiveCeiling(activePartitions: readonly string[]): number | undefined;
	maxIdleMs(configuredMaxIdleMs: number, activePartitions: readonly string[]): number;
	status(activePartitions: readonly string[]): Status;
}
