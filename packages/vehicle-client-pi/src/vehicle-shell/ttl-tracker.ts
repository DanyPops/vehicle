/**
 * A decaying-TTL cache over Pi's active-tool set, turn-scoped. Split out of vehicle-shell.ts's
 * own bundled concerns -- pure, Pi-agnostic state machine with no dependency on the rest of the
 * shell.
 */

/**
 * Every tracked tool name carries a current and a starting TTL (in turns); a tool actually called
 * during a turn is refreshed back to its own starting value, everything else decrements by one --
 * reaching zero evicts it (removed from the tracker; the underlying Pi tool stays registered, just
 * inactive until re-seeded).
 *
 * Deliberately name-keyed and Pi-agnostic: this file never touches ExtensionAPI directly, so its
 * decay/refresh logic is testable as a pure state machine. Shared by every vehicle in this process
 * (see vehicle-shell-bootstrap.ts's module-level singleton) -- tool names are already globally
 * unique process-wide (that's precisely why two vehicles registering the same name is a problem in
 * the first place), so one tracker safely holds every vehicle's own entries side by side.
 */
export class VehicleShellTtlTracker {
	private readonly entries = new Map<string, { current: number; readonly starting: number }>();
	private readonly calledThisTurn = new Set<string>();

	/** Starts (or re-activates) tracking a tool name at the given starting TTL -- also used to
	 * refresh an already-tracked tool back to full TTL (e.g. a repeat tools_man call). */
	seed(toolName: string, startingTtl: number): void {
		this.entries.set(toolName, { current: startingTtl, starting: startingTtl });
	}

	/** Marks a tracked tool as called this turn -- a no-op for a name this tracker isn't tracking
	 * (the two meta-tools themselves, or any tool outside this Vehicle's own managed set). */
	recordCall(toolName: string): void {
		if (this.entries.has(toolName)) this.calledThisTurn.add(toolName);
	}

	/**
	 * Applies one turn's decay: a tool called this turn resets to its own starting TTL (stays
	 * warm, not just "not yet decremented"); every other tracked tool decrements by one. A tool
	 * that reaches zero is evicted (removed from tracking) and reported in the returned list.
	 */
	tick(): { readonly evicted: readonly string[] } {
		const evicted: string[] = [];
		for (const [toolName, entry] of this.entries) {
			if (this.calledThisTurn.has(toolName)) {
				entry.current = entry.starting;
				continue;
			}
			entry.current -= 1;
			if (entry.current <= 0) evicted.push(toolName);
		}
		for (const toolName of evicted) this.entries.delete(toolName);
		this.calledThisTurn.clear();
		return { evicted };
	}

	/** Every currently-tracked (non-evicted) tool name -- the TTL-managed subset of the active set. */
	trackedNames(): readonly string[] {
		return [...this.entries.keys()];
	}

	isTracked(toolName: string): boolean {
		return this.entries.has(toolName);
	}

	/** Turns remaining before this tool decays out, or undefined when it isn't currently tracked --
	 * the read-only counterpart to seed()/tick(), for a caller (tools_type) that needs to report
	 * "how much longer is this callable" without mutating anything itself. */
	remainingTurns(toolName: string): number | undefined {
		return this.entries.get(toolName)?.current;
	}
}
