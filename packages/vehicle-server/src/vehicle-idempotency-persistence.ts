/**
 * Durable state for VehicleIdempotencyPolicy, built on vehicle-core's own createAtomicJsonWriter --
 * one JSON file, temp+rename, never a half-written snapshot. Mirrors vehicle-job-persistence.ts
 * exactly: only settled receipts are ever persisted (a still-pending/in-flight request has no
 * receipt yet and can't meaningfully resume across a restart -- the original in-flight execution
 * is simply gone, the same conclusion VehicleJobStore.restore() reaches for a "running" job).
 * VehicleIdempotencyPolicy decides *what* to persist (already bounded by its own eviction sweep
 * before this is ever called); this module only decides *how*, and refuses to let a corrupt or
 * foreign-shaped file on disk break restore -- load() returns undefined instead of throwing for
 * anything that doesn't look like a real snapshot.
 */
import type { AtomicJsonFsAdapter, VehicleFailure } from "@danypops/vehicle-core";
import { createAtomicJsonWriter } from "@danypops/vehicle-core";

export interface VehicleIdempotencyPersistedReceipt {
	readonly key: string;
	readonly operationName: string;
	readonly operationVersion: number;
	readonly inputHash: string;
	readonly settledAt: number;
	readonly expiresAt: number;
	readonly sizeBytes: number;
	readonly ok: boolean;
	readonly output?: unknown;
	readonly failure?: VehicleFailure;
}

export interface VehicleIdempotencyPersistedSnapshot {
	readonly version: 1;
	readonly savedAt: number;
	readonly receipts: readonly VehicleIdempotencyPersistedReceipt[];
}

export interface VehicleIdempotencyPersistenceAdapter {
	save(snapshot: VehicleIdempotencyPersistedSnapshot): Promise<void>;
	/** Returns undefined if there's nothing to restore, or what's on disk doesn't look like a real snapshot -- never throws for a corrupt/foreign file. */
	load(): Promise<VehicleIdempotencyPersistedSnapshot | undefined>;
}

function isVehicleFailureShaped(value: unknown): value is VehicleFailure {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value as Record<string, unknown>;
	return typeof candidate.code === "string" && typeof candidate.category === "string" && typeof candidate.message === "string";
}

function isVehicleIdempotencyPersistedReceipt(value: unknown): value is VehicleIdempotencyPersistedReceipt {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value as Record<string, unknown>;
	if (
		typeof candidate.key !== "string" ||
		typeof candidate.operationName !== "string" ||
		typeof candidate.operationVersion !== "number" ||
		typeof candidate.inputHash !== "string" ||
		typeof candidate.settledAt !== "number" ||
		typeof candidate.expiresAt !== "number" ||
		typeof candidate.sizeBytes !== "number" ||
		typeof candidate.ok !== "boolean"
	) {
		return false;
	}
	if (candidate.ok) return true;
	return isVehicleFailureShaped(candidate.failure);
}

function isVehicleIdempotencyPersistedSnapshot(value: unknown): value is VehicleIdempotencyPersistedSnapshot {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value as Record<string, unknown>;
	return (
		candidate.version === 1 &&
		typeof candidate.savedAt === "number" &&
		Array.isArray(candidate.receipts) &&
		candidate.receipts.every(isVehicleIdempotencyPersistedReceipt)
	);
}

export interface CreateFileVehicleIdempotencyPersistenceOptions {
	readonly filePath: string;
	readonly fs: AtomicJsonFsAdapter;
	/** Called with whatever malformed value was found on disk, right before it's discarded in favor of an empty restore. Optional -- a caller with no logger just loses the diagnostic, not correctness. */
	readonly onCorruptSnapshot?: (raw: unknown) => void;
}

export function createFileVehicleIdempotencyPersistence(
	options: CreateFileVehicleIdempotencyPersistenceOptions,
): VehicleIdempotencyPersistenceAdapter {
	const writer = createAtomicJsonWriter({ fs: options.fs });
	return {
		save: (snapshot) => writer.write(options.filePath, snapshot),
		async load() {
			const raw = await writer.read(options.filePath);
			if (raw === undefined) return undefined;
			if (!isVehicleIdempotencyPersistedSnapshot(raw)) {
				options.onCorruptSnapshot?.(raw);
				return undefined;
			}
			return raw;
		},
	};
}
