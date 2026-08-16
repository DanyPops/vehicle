import type { VehicleJobStatus } from "./termination.js";

/** Minimal shape selectVehicleJobsForEviction needs from a job record -- kept separate from VehicleJobSnapshot so vehicle-server doesn't have to construct a full snapshot just to ask "should this be swept". */
export interface VehicleJobEvictionCandidate {
	readonly jobId: string;
	readonly status: VehicleJobStatus;
	readonly delivered: boolean;
	readonly updatedAt: number;
}

export interface VehicleJobRetentionOptions {
	/** Hard cap on total retained job records (of any status). A running job is never evicted regardless of this cap. */
	readonly maxRetainedJobs: number;
	/** A delivered terminal job becomes eligible for eviction once this many ms have passed since it was delivered (== updatedAt at delivery time). */
	readonly deliveredRetentionMs: number;
	readonly now: number;
}

/**
 * Pure eviction-selection policy, kept separate from VehicleJobStore's own
 * bookkeeping so the bounded-retention rule is independently testable.
 * Preference order: (1) delivered and past deliveredRetentionMs, oldest
 * first; (2) once still over maxRetainedJobs, any delivered terminal job,
 * oldest first; (3) only as a last resort, an undelivered terminal job,
 * oldest first -- a real loss (a caller may still want that result), but
 * an unbounded store is a worse failure mode. A running job is never a
 * candidate.
 */
export function selectVehicleJobsForEviction(
	candidates: readonly VehicleJobEvictionCandidate[],
	options: VehicleJobRetentionOptions,
): readonly string[] {
	const terminal = candidates.filter((candidate) => candidate.status !== "running");
	const byAgeAscending = (a: VehicleJobEvictionCandidate, b: VehicleJobEvictionCandidate) => a.updatedAt - b.updatedAt;

	const evicted = new Set<string>();
	for (const candidate of terminal) {
		if (candidate.delivered && options.now - candidate.updatedAt >= options.deliveredRetentionMs) evicted.add(candidate.jobId);
	}

	const remainingCount = () => candidates.length - evicted.size;
	if (remainingCount() > options.maxRetainedJobs) {
		const deliveredOldestFirst = terminal.filter((candidate) => candidate.delivered && !evicted.has(candidate.jobId)).sort(byAgeAscending);
		for (const candidate of deliveredOldestFirst) {
			if (remainingCount() <= options.maxRetainedJobs) break;
			evicted.add(candidate.jobId);
		}
	}
	if (remainingCount() > options.maxRetainedJobs) {
		const undeliveredOldestFirst = terminal
			.filter((candidate) => !candidate.delivered && !evicted.has(candidate.jobId))
			.sort(byAgeAscending);
		for (const candidate of undeliveredOldestFirst) {
			if (remainingCount() <= options.maxRetainedJobs) break;
			evicted.add(candidate.jobId);
		}
	}
	return [...evicted];
}
