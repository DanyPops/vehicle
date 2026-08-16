/**
 * Pure pieces of Vehicle's bounded keyed-idempotency replay policy: the settled-receipt shape and
 * its eviction-selection rule. Orchestration (in-flight dedup, persistence, fail-closed conflict
 * detection) lives in vehicle-server's VehicleIdempotencyPolicy -- mirrors the vehicle-jobs.js /
 * VehicleJobStore split (a pure, independently-testable bounded-retention rule here; the stateful
 * store that calls it lives in vehicle-server).
 */
import type { VehicleFailure } from "../errors/error.js";

/** A settled keyed-idempotency outcome -- exactly what gets replayed to a caller reusing the same key. Never carries the original request's raw input (only its hash is ever retained, see VehicleIdempotencyReceipt) and never a credential: `output`/`failure` are already what the operation would hand back to any caller, the same wire-safe boundary VehicleJobPersistedRecord's own `output`/`error` fields already cross. */
export type VehicleIdempotencyResult =
	| { readonly ok: true; readonly output: unknown }
	| { readonly ok: false; readonly failure: VehicleFailure };

/**
 * One settled keyed-idempotency receipt. Deliberately excludes the original request's raw input --
 * `inputHash` is the only trace of it retained, so a persisted receipt can never leak whatever the
 * caller originally sent (which may carry sensitive arguments the operation's own output does not).
 * A still-in-flight (pending) request has no receipt yet -- that bookkeeping is transient,
 * in-memory-only state in VehicleIdempotencyPolicy, deliberately never a candidate for persistence
 * or eviction (mirrors "a running job is never a candidate" in vehicle-jobs.js's own job eviction).
 */
export interface VehicleIdempotencyReceipt {
	readonly key: string;
	readonly operationName: string;
	readonly operationVersion: number;
	readonly inputHash: string;
	readonly settledAt: number;
	/** settledAt + the descriptor's own keyed retentionMs at the time this receipt settled. A receipt past this is no longer a valid replay -- see selectVehicleIdempotencyReceiptsForEviction. */
	readonly expiresAt: number;
	readonly result: VehicleIdempotencyResult;
	/** Approximate serialized size of `result`, used only to enforce maxTotalBytes -- never exact byte-for-byte, matching every other Vehicle capacity bound's own "good enough to stay bounded" precedent (e.g. enforcePayloadSize). */
	readonly sizeBytes: number;
}

/** Minimal shape selectVehicleIdempotencyReceiptsForEviction needs -- kept separate from VehicleIdempotencyReceipt's own `result` so a sweep never has to touch (or risk logging) the actual settled output/failure it's merely deciding whether to keep. */
export interface VehicleIdempotencyEvictionCandidate {
	readonly key: string;
	readonly settledAt: number;
	readonly expiresAt: number;
	readonly sizeBytes: number;
}

export interface VehicleIdempotencyRetentionOptions {
	/** Hard cap on total retained settled receipts. */
	readonly maxEntries: number;
	/** Hard cap on the sum of every retained receipt's own sizeBytes. */
	readonly maxTotalBytes: number;
	readonly now: number;
}

/**
 * Pure eviction-selection policy for settled keyed-idempotency receipts, independently testable
 * from VehicleIdempotencyPolicy's own bookkeeping -- mirrors selectVehicleJobsForEviction's own
 * three-phase shape:
 *
 *  1. Any receipt already past its own `expiresAt` (a real per-operation retentionMs elapsed --
 *     replaying it would no longer be correct, keeping it around would only be wasted memory).
 *  2. If still over maxEntries once (1) is applied, the oldest remaining receipts by settledAt,
 *     until back within budget.
 *  3. If still over maxTotalBytes once (1)+(2) are applied, the oldest remaining receipts by
 *     settledAt, until back within budget.
 *
 * A pending (still in-flight) request is never a candidate -- it has no receipt yet, so it can
 * never appear in `candidates` at all; this function only ever sees settled ones.
 */
export function selectVehicleIdempotencyReceiptsForEviction(
	candidates: readonly VehicleIdempotencyEvictionCandidate[],
	options: VehicleIdempotencyRetentionOptions,
): readonly string[] {
	const byAgeAscending = (a: VehicleIdempotencyEvictionCandidate, b: VehicleIdempotencyEvictionCandidate) => a.settledAt - b.settledAt;

	const evicted = new Set<string>();
	for (const candidate of candidates) {
		if (options.now >= candidate.expiresAt) evicted.add(candidate.key);
	}

	const remaining = () => candidates.filter((candidate) => !evicted.has(candidate.key));
	if (remaining().length > options.maxEntries) {
		const oldestFirst = remaining().sort(byAgeAscending);
		for (const candidate of oldestFirst) {
			if (remaining().length <= options.maxEntries) break;
			evicted.add(candidate.key);
		}
	}

	const totalBytes = () => remaining().reduce((sum, candidate) => sum + candidate.sizeBytes, 0);
	if (totalBytes() > options.maxTotalBytes) {
		const oldestFirst = remaining().sort(byAgeAscending);
		for (const candidate of oldestFirst) {
			if (totalBytes() <= options.maxTotalBytes) break;
			evicted.add(candidate.key);
		}
	}

	return [...evicted];
}
