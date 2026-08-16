/**
 * A weighted-LRU eviction primitive over Pi's active-tool set -- Phase 2 of the design that
 * replaces VehicleShellTtlTracker's fixed-turn-count decay (see that file's own doc comment for
 * the three problems this fixes: no relationship to actual size, no global cap, eviction
 * decoupled from real context pressure).
 *
 * Pure, Pi-agnostic state machine with no dependency on the rest of the shell -- same testability
 * discipline as ttl-tracker.ts. Split out of vehicle-shell.ts's own bundled concerns.
 */

/** Every call/(re)activation adds this, divided by the entry's own weight, to its priority --
 * the "dampened by weight" mechanic: a heavier tool earns proportionally less priority credit
 * per use than a lighter one, so two tools called equally often still end up ranked apart, with
 * the heavier one sitting closer to eviction. The absolute value is arbitrary (only relative
 * ordering between entries ever matters) -- chosen large enough that priority deltas between a
 * 50-token and a 5,000-token tool stay comfortably distinguishable in floating point. Overridable
 * per-tracker (see the constructor) for a caller that wants every entry to compete more or less
 * aggressively for ranking in absolute terms -- note this has NO effect on relative eviction
 * order between two entries in the SAME tracker (`credit` cancels out of the bump ratio between
 * any two entries), only on priority's own absolute magnitude; bootstrap.ts's own legacy-TTL
 * backward-compat mapping uses the budget bounds instead, precisely because of this. */
export const DEFAULT_CALL_CREDIT = 1_000_000;

interface WeightedLruEntry {
	weightTokens: number;
	priority: number;
}

/** One tracked tool's own weight/priority, for a caller (tools_type, Phase 4) that needs to
 * report standing without mutating anything -- ordered ascending by priority (index 0 is the
 * entry evictToBudget would remove first under any pressure at all). */
export interface WeightedLruSnapshotEntry {
	readonly toolName: string;
	readonly weightTokens: number;
	readonly priority: number;
}

/**
 * Entries keyed by tool name, each carrying its own weightTokens (from tool-weight.ts's
 * estimator, computed once at activation) and a priority accumulated over calls. Eviction always
 * removes the lowest-priority entries first, and never removes one called/(re)activated during
 * the current turn -- mirrors VehicleShellTtlTracker's own "called this turn" protection, so a
 * tool can never be evicted the very turn it was just seeded or used.
 */
export class WeightedLruTracker {
	private readonly entries = new Map<string, WeightedLruEntry>();
	private readonly calledThisTurn = new Set<string>();

	/** @param callCredit Overrides DEFAULT_CALL_CREDIT -- see that constant's own doc comment for why
	 * a caller (bootstrap.ts, mapping a deprecated TTL setting) might scale this. */
	constructor(private readonly callCredit: number = DEFAULT_CALL_CREDIT) {}

	private bump(weightTokens: number): number {
		return this.callCredit / Math.max(1, weightTokens);
	}

	/** Starts (or re-activates) tracking a tool at its own weight -- also used to refresh an
	 * already-tracked tool (e.g. a repeat tools_man call): its weight is updated (schema could in
	 * principle change across a reconnect) and it receives a fresh priority bump. Protected from
	 * eviction for the remainder of the current turn, exactly like a real call would be -- an
	 * operation just activated must survive at least until the next turn boundary. */
	seed(toolName: string, weightTokens: number): void {
		const existing = this.entries.get(toolName);
		const priority = (existing?.priority ?? 0) + this.bump(weightTokens);
		this.entries.set(toolName, { weightTokens, priority });
		this.calledThisTurn.add(toolName);
	}

	/** Marks a tracked tool as called this turn and bumps its priority -- a no-op for a name this
	 * tracker isn't tracking (the two meta-tools themselves, or any tool outside this Vehicle
	 * Shell's own managed set), mirroring VehicleShellTtlTracker.recordCall exactly. */
	recordCall(toolName: string): void {
		const entry = this.entries.get(toolName);
		if (!entry) return;
		entry.priority += this.bump(entry.weightTokens);
		this.calledThisTurn.add(toolName);
	}

	/** Sum of every currently-tracked entry's own weight -- the number evictToBudget compares
	 * against `targetTotalTokens`. */
	totalWeightTokens(): number {
		let total = 0;
		for (const entry of this.entries.values()) total += entry.weightTokens;
		return total;
	}

	/**
	 * Evicts the lowest-priority entries, one at a time, until the total tracked weight is at or
	 * under `targetTotalTokens` -- or until every remaining entry is protected (called/seeded this
	 * turn), whichever comes first. Never evicts a protected entry even if that means staying over
	 * budget; a real, in-flight tool always wins over a hard cap. Clears the turn's own call
	 * markers before returning, exactly like VehicleShellTtlTracker.tick() -- one evictToBudget
	 * call per turn boundary, mirroring tick()'s own combined "apply decay, then clear" contract.
	 */
	evictToBudget(targetTotalTokens: number): { readonly evicted: readonly string[] } {
		const evictable = [...this.entries].filter(([toolName]) => !this.calledThisTurn.has(toolName));
		evictable.sort((left, right) => left[1].priority - right[1].priority);

		let total = this.totalWeightTokens();
		const evicted: string[] = [];
		for (const [toolName, entry] of evictable) {
			if (total <= targetTotalTokens) break;
			this.entries.delete(toolName);
			total -= entry.weightTokens;
			evicted.push(toolName);
		}
		this.calledThisTurn.clear();
		return { evicted };
	}

	/** Every currently-tracked (non-evicted) tool name -- the weighted-LRU-managed subset of the
	 * active set, mirroring VehicleShellTtlTracker.trackedNames(). */
	trackedNames(): readonly string[] {
		return [...this.entries.keys()];
	}

	isTracked(toolName: string): boolean {
		return this.entries.has(toolName);
	}

	/** This tool's own tracked weight, or undefined when it isn't currently tracked -- the
	 * read-only counterpart tools_type (Phase 4) needs in place of remainingTtlTurns. */
	weightOf(toolName: string): number | undefined {
		return this.entries.get(toolName)?.weightTokens;
	}

	/** Every tracked entry, ordered ascending by priority (least-recently-credited/heaviest-under-
	 * equal-use first) -- exactly the order evictToBudget would remove them in, for a caller that
	 * needs to report standing (e.g. "how close is this to being evicted") without mutating
	 * anything itself. */
	snapshot(): readonly WeightedLruSnapshotEntry[] {
		return [...this.entries]
			.sort((left, right) => left[1].priority - right[1].priority)
			.map(([toolName, entry]) => ({ toolName, weightTokens: entry.weightTokens, priority: entry.priority }));
	}
}

/**
 * True when `toolName` is (tied for) the single lowest-priority entry currently tracked -- the
 * very first candidate evictToBudget would remove if any eviction at all becomes necessary. Not
 * a prediction of "will actually be evicted soon" (that also depends on the current budget, which
 * this function deliberately doesn't need) -- just "stands least protected right now, relative to
 * every other tracked entry." Used by tools_type (name-resolution.ts) to report standing under
 * the weighted-LRU model, replacing the old remainingTtlTurns countdown.
 */
export function isMostEvictable(tracker: WeightedLruTracker, toolName: string): boolean {
	const snapshot = tracker.snapshot();
	if (snapshot.length === 0) return false;
	const lowestPriority = snapshot[0]!.priority;
	const entry = snapshot.find((candidate) => candidate.toolName === toolName);
	return entry !== undefined && entry.priority === lowestPriority;
}
