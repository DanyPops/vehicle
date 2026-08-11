/**
 * A reusable VehicleExecutionPolicy for VehicleRegistry.setExecutionPolicy(): bounded, keyed
 * request deduplication and settled-result replay, so every daemon on this substrate (papyrus,
 * pipes, tickets, enigma, ...) shares one correct implementation instead of hand-rolling its own
 * idempotency receipts. Only ever engages for an operation whose own descriptor declares
 * `idempotency: { mode: "keyed", retentionMs }` -- every other operation passes straight through
 * to `invoke()` untouched, so installing this policy is safe even in a registry that mixes keyed
 * and non-keyed operations (VehicleRegistry itself already guarantees a keyed operation's
 * idempotencyKey is present and non-blank by the time a VehicleExecutionPolicy ever sees the
 * request -- see vehicle-registry.ts's own idempotency-key-required check).
 *
 * Three request shapes for the same key:
 *  - No entry yet: execute for real, tracking the in-flight promise as "pending".
 *  - An entry already pending for the identical (operation, version, input hash): join the SAME
 *    promise -- the real handler runs exactly once, every concurrent duplicate shares its result.
 *  - An entry already settled and still within its own retentionMs: replay the stored result,
 *    without re-invoking the handler at all.
 *  - An entry (pending or settled) for a DIFFERENT operation, version, or input hash: fail closed
 *    with `idempotency-conflict` -- reusing a key never silently runs a second, different request.
 *
 * What gets cached as a settled failure vs. rethrown-and-forgotten: only a failure whose code
 * appears in the operation's own declared `errors` (its published failure contract) is cached and
 * replayed -- an "expected" failure the operation's own author already committed to as a stable,
 * meaningful outcome for this input. Anything else (a bare `handler-failed`, `deadline-exceeded`,
 * `cancelled`, ...) is treated as a programmer/transient failure: the pending entry is dropped
 * entirely so the NEXT call for that key gets a real retry, not a permanently wedged key replaying
 * the same internal error forever. This is the exact bug class Papyrus hit in the wild (task
 * a54f0649: "a local-validation failure after a mutation receipt is filed permanently wedges that
 * task's submit -- no self-service recovery") -- this policy is deliberately built so it can't
 * reproduce it.
 */
import { createHash } from "node:crypto";
import {
	isVehicleError,
	selectVehicleIdempotencyReceiptsForEviction,
	VehicleError,
	type VehicleFailure,
	vehicleErrorFromFailure,
} from "@danypops/vehicle-core";
import type { VehicleIdempotencyPersistedReceipt, VehicleIdempotencyPersistenceAdapter } from "./vehicle-idempotency-persistence.js";
import type { VehicleExecutionPolicy, VehicleExecutionRequest } from "./vehicle-registry.js";

const DEFAULT_MAX_ENTRIES = 10_000;
const DEFAULT_MAX_TOTAL_BYTES = 10 * 1024 * 1024;

/** Same content-hash primitive vehicle-approval-authority.ts's own hashApprovalInput already established for exactly this concern (JSON.stringify + sha256, insertion-order-sensitive, not deep-canonicalized) -- reused verbatim rather than a second, subtly-different hashing convention for the same kind of comparison. */
function hashIdempotencyInput(input: unknown): string {
	let serialized: string;
	try {
		serialized = JSON.stringify(input) ?? "undefined";
	} catch {
		serialized = String(input);
	}
	return createHash("sha256").update(serialized).digest("hex");
}

/** Approximate, bounded -- matches every other Vehicle size accounting (e.g. enforcePayloadSize): good enough to stay bounded, never exact. */
function approximateSizeBytes(value: unknown): number {
	try {
		const json = JSON.stringify(value);
		return json === undefined ? 0 : Buffer.byteLength(json, "utf8");
	} catch {
		return 0;
	}
}

interface SettledEntry {
	readonly state: "settled";
	readonly operationName: string;
	readonly operationVersion: number;
	readonly inputHash: string;
	readonly settledAt: number;
	readonly expiresAt: number;
	readonly sizeBytes: number;
	readonly result: { readonly ok: true; readonly output: unknown } | { readonly ok: false; readonly failure: VehicleFailure };
}

interface PendingEntry {
	readonly state: "pending";
	readonly operationName: string;
	readonly operationVersion: number;
	readonly inputHash: string;
	readonly promise: Promise<unknown>;
}

type Entry = SettledEntry | PendingEntry;

export interface VehicleIdempotencyPolicyOptions {
	/** Defaults to Date.now. */
	readonly now?: () => number;
	/** Omit for a pure in-memory policy -- restore()/persistence are then both no-ops. */
	readonly persistence?: VehicleIdempotencyPersistenceAdapter;
	/** Hard cap on total retained settled receipts. Defaults to 10,000. */
	readonly maxEntries?: number;
	/** Hard cap on the sum of every retained receipt's own approximate size. Defaults to 10MiB. */
	readonly maxTotalBytes?: number;
	/** Persistence is best-effort: a write failure (e.g. disk full) must never break a request's own execution. Defaults to a no-op. */
	readonly onPersistError?: (error: unknown) => void;
}

export interface VehicleIdempotencyRestoreResult {
	readonly restoredCount: number;
}

/** Thrown when a key is reused for a different operation, version, or input -- see this module's own doc comment. */
function conflictError(request: VehicleExecutionRequest, key: string): VehicleError {
	return new VehicleError("idempotency-conflict", `Idempotency key "${key}" was already used for a different operation or input`, {
		category: "conflict",
		operationId: request.operationId,
		details: { key, operation: request.operation.name, version: request.operation.version },
	});
}

export class VehicleIdempotencyPolicy implements VehicleExecutionPolicy {
	private readonly entries = new Map<string, Entry>();
	private readonly now: () => number;
	private readonly persistence?: VehicleIdempotencyPersistenceAdapter;
	private readonly maxEntries: number;
	private readonly maxTotalBytes: number;
	private readonly onPersistError: (error: unknown) => void;
	private persistChain: Promise<void> = Promise.resolve();

	constructor(options: VehicleIdempotencyPolicyOptions = {}) {
		this.now = options.now ?? Date.now;
		this.persistence = options.persistence;
		this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
		this.maxTotalBytes = options.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES;
		this.onPersistError = options.onPersistError ?? (() => {});
	}

	/**
	 * Loads whatever this policy's persistence adapter has on disk. Call once at daemon startup,
	 * before serving any request. A no-op if no persistence adapter was configured, or nothing was
	 * ever saved. Only ever restores settled receipts -- there is no such thing as a persisted
	 * pending one (see this module's own doc comment on why an in-flight request can't resume).
	 */
	async restore(): Promise<VehicleIdempotencyRestoreResult> {
		if (!this.persistence) return { restoredCount: 0 };
		const snapshot = await this.persistence.load();
		if (!snapshot) return { restoredCount: 0 };

		for (const persisted of snapshot.receipts) {
			this.entries.set(persisted.key, {
				state: "settled",
				operationName: persisted.operationName,
				operationVersion: persisted.operationVersion,
				inputHash: persisted.inputHash,
				settledAt: persisted.settledAt,
				expiresAt: persisted.expiresAt,
				sizeBytes: persisted.sizeBytes,
				result: persisted.ok ? { ok: true, output: persisted.output } : { ok: false, failure: persisted.failure! },
			});
		}
		this.sweep();
		return { restoredCount: snapshot.receipts.length };
	}

	/** Resolves once every persistence write scheduled so far has settled. No-op if no persistence adapter is configured. Intended for tests and a clean daemon shutdown, not the request path. */
	async flushPersistence(): Promise<void> {
		await this.persistChain;
	}

	async execute(request: VehicleExecutionRequest, invoke: (effectiveInput: unknown) => Promise<unknown>): Promise<unknown> {
		if (request.operation.idempotency.mode !== "keyed" || !request.idempotencyKey) {
			return invoke(request.input);
		}
		const key = request.idempotencyKey;
		const retentionMs = request.operation.idempotency.retentionMs;
		const inputHash = hashIdempotencyInput(request.input);
		const identityMatches = (entry: Entry) =>
			entry.operationName === request.operation.name &&
			entry.operationVersion === request.operation.version &&
			entry.inputHash === inputHash;

		const existing = this.entries.get(key);
		if (existing) {
			if (!identityMatches(existing)) throw conflictError(request, key);
			if (existing.state === "pending") return existing.promise;
			if (this.now() < existing.expiresAt) {
				if (existing.result.ok) return existing.result.output;
				throw vehicleErrorFromFailure(existing.result.failure);
			}
			// Past its own retention window -- no longer a valid replay; fall through and re-execute.
			this.entries.delete(key);
		}

		const promise = invoke(request.input).then(
			(output) => {
				this.settle(key, request.operation.name, request.operation.version, inputHash, retentionMs, { ok: true, output });
				return output;
			},
			(error: unknown) => {
				// invoke() (VehicleRegistry's own wrapper) already normalizes every thrown value into a
				// real VehicleError before this policy ever sees it -- see vehicle-registry.ts's invoke().
				const failure = isVehicleError(error)
					? error.toFailure()
					: { code: "internal", category: "internal" as const, message: String(error), retryable: false };
				const isDeclaredContractFailure = request.operation.errors.some((declared) => declared.code === failure.code);
				if (isDeclaredContractFailure) {
					this.settle(key, request.operation.name, request.operation.version, inputHash, retentionMs, { ok: false, failure });
				} else {
					// Not a failure mode this operation ever committed to -- never wedge the key; let the next call retry for real.
					this.entries.delete(key);
				}
				this.sweep();
				throw error;
			},
		);
		this.entries.set(key, {
			state: "pending",
			operationName: request.operation.name,
			operationVersion: request.operation.version,
			inputHash,
			promise,
		});
		return promise;
	}

	private settle(
		key: string,
		operationName: string,
		operationVersion: number,
		inputHash: string,
		retentionMs: number,
		result: SettledEntry["result"],
	): void {
		const settledAt = this.now();
		this.entries.set(key, {
			state: "settled",
			operationName,
			operationVersion,
			inputHash,
			settledAt,
			expiresAt: settledAt + retentionMs,
			sizeBytes: approximateSizeBytes(result.ok ? result.output : result.failure),
			result,
		});
		this.schedulePersist();
		this.sweep();
	}

	/** Bounded-retention eviction: see selectVehicleIdempotencyReceiptsForEviction for the actual policy. A pending (in-flight) entry is never a candidate. */
	private sweep(): void {
		const settled = [...this.entries.entries()].filter((pair): pair is [string, SettledEntry] => pair[1].state === "settled");
		const evictedKeys = selectVehicleIdempotencyReceiptsForEviction(
			settled.map(([key, entry]) => ({ key, settledAt: entry.settledAt, expiresAt: entry.expiresAt, sizeBytes: entry.sizeBytes })),
			{ maxEntries: this.maxEntries, maxTotalBytes: this.maxTotalBytes, now: this.now() },
		);
		if (evictedKeys.length === 0) return;
		for (const key of evictedKeys) this.entries.delete(key);
		this.schedulePersist();
	}

	/**
	 * Writes always run one at a time, chained onto persistChain, so two settlements racing never
	 * produce two overlapping writes to the same file -- mirrors VehicleJobStore's own
	 * schedulePersist() precedent exactly. Best-effort: a save() failure is reported via
	 * onPersistError and otherwise swallowed -- a disk-full daemon must keep serving requests, not
	 * crash them.
	 */
	private schedulePersist(): void {
		if (!this.persistence) return;
		const persistence = this.persistence;
		this.persistChain = this.persistChain.then(async () => {
			const receipts: VehicleIdempotencyPersistedReceipt[] = [...this.entries.entries()]
				.filter((pair): pair is [string, SettledEntry] => pair[1].state === "settled")
				.map(([key, entry]) => ({
					key,
					operationName: entry.operationName,
					operationVersion: entry.operationVersion,
					inputHash: entry.inputHash,
					settledAt: entry.settledAt,
					expiresAt: entry.expiresAt,
					sizeBytes: entry.sizeBytes,
					ok: entry.result.ok,
					...(entry.result.ok ? { output: entry.result.output } : { failure: entry.result.failure }),
				}));
			try {
				await persistence.save({ version: 1, savedAt: this.now(), receipts });
			} catch (error) {
				this.onPersistError(error);
			}
		});
	}
}
