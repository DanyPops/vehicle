import { describe, expect, it } from "bun:test";
import type { AtomicJsonFsAdapter } from "@danypops/vehicle-core";
import {
	createFileVehicleIdempotencyPersistence,
	type VehicleIdempotencyPersistedSnapshot,
} from "../src/vehicle-idempotency-persistence.ts";

function createFakeFs(): AtomicJsonFsAdapter & { readonly files: Map<string, string> } {
	const files = new Map<string, string>();
	return {
		files,
		async writeFile(path, data) {
			files.set(path, data);
		},
		async rename(oldPath, newPath) {
			const data = files.get(oldPath);
			if (data === undefined) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
			files.set(newPath, data);
			files.delete(oldPath);
		},
		async unlink(path) {
			files.delete(path);
		},
		async readFile(path) {
			const data = files.get(path);
			if (data === undefined) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
			return data;
		},
	};
}

const validSnapshot: VehicleIdempotencyPersistedSnapshot = {
	version: 1,
	savedAt: 1_000,
	receipts: [
		{
			key: "req-1",
			operationName: "test.op",
			operationVersion: 1,
			inputHash: "abc123",
			settledAt: 100,
			expiresAt: 60_100,
			sizeBytes: 12,
			ok: true,
			output: { answer: 42 },
		},
		{
			key: "req-2",
			operationName: "test.op",
			operationVersion: 1,
			inputHash: "def456",
			settledAt: 200,
			expiresAt: 60_200,
			sizeBytes: 30,
			ok: false,
			failure: { code: "already-exists", category: "conflict", message: "already exists", retryable: false },
		},
	],
};

describe("createFileVehicleIdempotencyPersistence", () => {
	it("round-trips a snapshot through save()/load()", async () => {
		const fs = createFakeFs();
		const persistence = createFileVehicleIdempotencyPersistence({ filePath: "/state/idempotency.json", fs });
		await persistence.save(validSnapshot);
		await expect(persistence.load()).resolves.toEqual(validSnapshot);
	});

	it("load() returns undefined when nothing has ever been saved", async () => {
		const fs = createFakeFs();
		const persistence = createFileVehicleIdempotencyPersistence({ filePath: "/state/idempotency.json", fs });
		await expect(persistence.load()).resolves.toBeUndefined();
	});

	it("load() discards a malformed file instead of throwing, and reports it via onCorruptSnapshot", async () => {
		const fs = createFakeFs();
		fs.files.set("/state/idempotency.json", JSON.stringify({ not: "a snapshot" }));
		let reported: unknown;
		const persistence = createFileVehicleIdempotencyPersistence({
			filePath: "/state/idempotency.json",
			fs,
			onCorruptSnapshot: (raw) => {
				reported = raw;
			},
		});
		await expect(persistence.load()).resolves.toBeUndefined();
		expect(reported).toEqual({ not: "a snapshot" });
	});

	it("load() discards a receipt missing required fields", async () => {
		const fs = createFakeFs();
		fs.files.set("/state/idempotency.json", JSON.stringify({ version: 1, savedAt: 1, receipts: [{ key: "x" }] }));
		const persistence = createFileVehicleIdempotencyPersistence({ filePath: "/state/idempotency.json", fs });
		await expect(persistence.load()).resolves.toBeUndefined();
	});

	it("load() discards a failed receipt whose failure field isn't a real VehicleFailure shape", async () => {
		const fs = createFakeFs();
		fs.files.set(
			"/state/idempotency.json",
			JSON.stringify({
				version: 1,
				savedAt: 1,
				receipts: [
					{
						key: "req-1",
						operationName: "test.op",
						operationVersion: 1,
						inputHash: "abc",
						settledAt: 1,
						expiresAt: 2,
						sizeBytes: 1,
						ok: false,
						failure: { not: "a failure" },
					},
				],
			}),
		);
		const persistence = createFileVehicleIdempotencyPersistence({ filePath: "/state/idempotency.json", fs });
		await expect(persistence.load()).resolves.toBeUndefined();
	});
});
