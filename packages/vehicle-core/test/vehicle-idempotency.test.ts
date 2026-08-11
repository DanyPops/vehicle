import { describe, expect, it } from "bun:test";
import { selectVehicleIdempotencyReceiptsForEviction, type VehicleIdempotencyEvictionCandidate } from "../src/vehicle-idempotency.ts";

function candidate(overrides: Partial<VehicleIdempotencyEvictionCandidate> = {}): VehicleIdempotencyEvictionCandidate {
	return { key: "k", settledAt: 0, expiresAt: 1_000_000, sizeBytes: 10, ...overrides };
}

describe("selectVehicleIdempotencyReceiptsForEviction", () => {
	it("evicts nothing when every receipt is fresh and well within both bounds", () => {
		const evicted = selectVehicleIdempotencyReceiptsForEviction([candidate({ key: "a" }), candidate({ key: "b" })], {
			maxEntries: 10,
			maxTotalBytes: 10_000,
			now: 500,
		});
		expect(evicted).toEqual([]);
	});

	it("evicts a receipt once past its own expiresAt, even under both caps", () => {
		const evicted = selectVehicleIdempotencyReceiptsForEviction(
			[candidate({ key: "expired", expiresAt: 1_000 }), candidate({ key: "fresh", expiresAt: 1_000_000 })],
			{ maxEntries: 100, maxTotalBytes: 100_000, now: 1_000 },
		);
		expect(evicted).toEqual(["expired"]);
	});

	it("prefers evicting the oldest receipts, by settledAt, once over maxEntries", () => {
		const evicted = selectVehicleIdempotencyReceiptsForEviction(
			[
				candidate({ key: "oldest", settledAt: 0 }),
				candidate({ key: "middle", settledAt: 100 }),
				candidate({ key: "newest", settledAt: 200 }),
			],
			{ maxEntries: 2, maxTotalBytes: 100_000, now: 1_000 },
		);
		expect(evicted).toEqual(["oldest"]);
	});

	it("evicts the oldest receipts, by settledAt, once over maxTotalBytes", () => {
		const evicted = selectVehicleIdempotencyReceiptsForEviction(
			[
				candidate({ key: "oldest", settledAt: 0, sizeBytes: 600 }),
				candidate({ key: "middle", settledAt: 100, sizeBytes: 600 }),
				candidate({ key: "newest", settledAt: 200, sizeBytes: 600 }),
			],
			{ maxEntries: 100, maxTotalBytes: 1_000, now: 1_000 },
		);
		expect(evicted).toEqual(["oldest", "middle"]);
	});

	it("applies expiry, then maxEntries, then maxTotalBytes in that order, never double-evicting an already-evicted key", () => {
		const evicted = selectVehicleIdempotencyReceiptsForEviction(
			[
				candidate({ key: "expired", settledAt: 0, expiresAt: 1, sizeBytes: 1 }),
				candidate({ key: "over-count", settledAt: 10, expiresAt: 1_000_000, sizeBytes: 1 }),
				candidate({ key: "kept", settledAt: 20, expiresAt: 1_000_000, sizeBytes: 1 }),
			],
			{ maxEntries: 1, maxTotalBytes: 1_000_000, now: 1_000 },
		);
		expect([...evicted].sort()).toEqual(["expired", "over-count"]);
	});

	it("evicts nothing for an empty candidate list", () => {
		expect(selectVehicleIdempotencyReceiptsForEviction([], { maxEntries: 1, maxTotalBytes: 1, now: 0 })).toEqual([]);
	});
});
