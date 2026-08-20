import { describe, expect, it } from "bun:test";
import {
	type BoundedResourcePool,
	BoundedResourcePool as Pool,
	type PooledResource,
	ResourceCapacityExceeded,
	ResourceInUse,
} from "../../src/resource-pool/bounded-resource-pool.js";

function fakeResource(label: string, closed: string[], overrides: Partial<PooledResource> = {}): PooledResource {
	return {
		async close() {
			closed.push(label);
		},
		...overrides,
	};
}

describe("BoundedResourcePool", () => {
	it("reuses one resource per (owner, partition) and refreshes its idle timestamp", async () => {
		let now = 100;
		let creates = 0;
		const closed: string[] = [];
		const pool: BoundedResourcePool<string, PooledResource> = new Pool({ now: () => now });

		const first = await pool.acquire("owner-a", "lang", () => {
			creates += 1;
			return fakeResource("lang", closed);
		});
		now = 150;
		await first[Symbol.asyncDispose]();
		const second = await pool.acquire("owner-a", "lang", () => {
			creates += 1;
			return fakeResource("lang", closed);
		});
		expect(second.value).toBe(first.value);
		expect(creates).toBe(1);
		await second[Symbol.asyncDispose]();

		now = 225;
		expect(await pool.reapIdle(100)).toBe(0);
		now = 251;
		expect(await pool.reapIdle(100)).toBe(1);
		expect(closed).toEqual(["lang"]);
	});

	it("keeps owner isolation for close and active-resource enumeration", async () => {
		const closed: string[] = [];
		const pool = new Pool<string, PooledResource>({});
		const leaseA = await pool.acquire("owner-a", "lang", () => fakeResource("a", closed));
		const leaseB = await pool.acquire("owner-b", "lang", () => fakeResource("b", closed));
		await leaseA[Symbol.asyncDispose]();
		await leaseB[Symbol.asyncDispose]();

		expect(pool.activeResourcesForOwner("owner-a")).toEqual([leaseA.value]);
		await pool.closeOwner("owner-a");
		expect(pool.has("owner-a", "lang")).toBe(false);
		expect(pool.has("owner-b", "lang")).toBe(true);
	});

	it("closePartition force-closes only the named partition for that owner", async () => {
		const closed: string[] = [];
		const pool = new Pool<string, PooledResource>({});
		const ts = await pool.acquire("owner-a", "typescript", () => fakeResource("typescript", closed));
		const rust = await pool.acquire("owner-a", "rust", () => fakeResource("rust", closed));
		await ts[Symbol.asyncDispose]();
		await rust[Symbol.asyncDispose]();

		await pool.closePartition("owner-a", "rust");

		expect(closed).toEqual(["rust"]);
		expect(pool.has("owner-a", "typescript")).toBe(true);
		expect(pool.has("owner-a", "rust")).toBe(false);
	});

	it("closePartition is a safe no-op for an unknown (owner, partition) pair", async () => {
		const pool = new Pool<string, PooledResource>({});
		await expect(pool.closePartition("never", "known")).resolves.toBeUndefined();
	});

	it("releaseOwnerIfIdle closes only the idle owner's own entries, leaving another owner warm", async () => {
		const closed: string[] = [];
		const pool = new Pool<string, PooledResource>({});
		const leaseA = await pool.acquire("owner-a", "lang", () => fakeResource("a", closed));
		await leaseA[Symbol.asyncDispose]();
		const leaseB = await pool.acquire("owner-b", "lang", () => fakeResource("b", closed));
		await leaseB[Symbol.asyncDispose]();

		const result = await pool.releaseOwnerIfIdle("owner-a");

		expect(result).toEqual({ closed: 1 });
		expect(pool.has("owner-a", "lang")).toBe(false);
		expect(pool.has("owner-b", "lang")).toBe(true);
		expect(closed).toEqual(["a"]);
	});

	it("releaseOwnerIfIdle refuses, closing nothing, while a lease is still active", async () => {
		const closed: string[] = [];
		const pool = new Pool<string, PooledResource>({});
		const lease = await pool.acquire("owner-a", "lang", () => fakeResource("a", closed));

		await expect(pool.releaseOwnerIfIdle("owner-a")).rejects.toBeInstanceOf(ResourceInUse);
		expect(pool.has("owner-a", "lang")).toBe(true);
		expect(closed).toEqual([]);

		await lease[Symbol.asyncDispose]();
	});

	it("releaseOwnerIfIdle is a safe no-op (closes 0) for an owner with nothing pooled at all", async () => {
		const pool = new Pool<string, PooledResource>({});
		expect(await pool.releaseOwnerIfIdle("never-warmed")).toEqual({ closed: 0 });
	});

	it("evicts the least-recently-used idle resource before admitting past capacity", async () => {
		let now = 1;
		const closed: string[] = [];
		const pool = new Pool<string, PooledResource>({ now: () => now, maxActive: 2, partitionLimits: { lang: 2 } });
		const first = await pool.acquire("a", "lang", () => fakeResource("a", closed));
		await first[Symbol.asyncDispose]();
		now = 2;
		const second = await pool.acquire("b", "lang", () => fakeResource("b", closed));
		await second[Symbol.asyncDispose]();
		now = 3;
		await using _third = await pool.acquire("c", "lang", () => fakeResource("c", closed));

		expect(closed).toEqual(["a"]);
		expect(pool.status()).toEqual({
			active: 2,
			leased: 1,
			maxActive: 2,
			effectiveMaxActive: 2,
			activeCeilingSource: "configured",
			absoluteMaxActive: 32,
			byPartition: { lang: 2 },
			waitingBackgroundAdmissions: 0,
		});
	});

	it("never evicts an active lease", async () => {
		const closed: string[] = [];
		const pool = new Pool<string, PooledResource>({ maxActive: 1, partitionLimits: { lang: 1 } });
		await using _active = await pool.acquire("a", "lang", () => fakeResource("a", closed));

		await expect(pool.acquire("b", "lang", () => fakeResource("b", closed))).rejects.toBeInstanceOf(ResourceCapacityExceeded);
		expect(closed).toEqual([]);
		expect(pool.status().active).toBe(1);
	});

	it("replaces a dead idle resource instead of reusing it", async () => {
		let creates = 0;
		let firstAlive = true;
		const closed: string[] = [];
		const events: unknown[] = [];
		const pool = new Pool<string, PooledResource>({ observe: (event) => events.push(event) });
		const create = (): PooledResource => {
			creates++;
			const label = `resource-${creates}`;
			return fakeResource(label, closed, { isAlive: () => creates > 1 || firstAlive });
		};
		const first = await pool.acquire("a", "lang", create);
		await first[Symbol.asyncDispose]();
		firstAlive = false;
		await using replacement = await pool.acquire("a", "lang", create);

		expect(replacement.value).not.toBe(first.value);
		expect(creates).toBe(2);
		expect(closed).toEqual(["resource-1"]);
		expect(events).toEqual([{ kind: "dead-replaced", partitionKey: "lang" }]);
	});

	it("retains a failed idle reap and reports path-free telemetry", async () => {
		let now = 0;
		const events: unknown[] = [];
		const pool = new Pool<string, PooledResource>({ now: () => now, observe: (event) => events.push(event) });
		const lease = await pool.acquire("a", "lang", () => ({ close: () => Promise.reject(new TypeError("private detail")) }));
		await lease[Symbol.asyncDispose]();
		now = 2;

		expect(await pool.reapIdle(1)).toBe(0);
		expect(pool.status().active).toBe(1);
		expect(events).toEqual([{ kind: "close-failed", reason: "idle-reap", partitionKey: "lang", errorName: "TypeError" }]);
		expect(JSON.stringify(events)).not.toContain("private detail");
	});

	it("calibrateCosts samples every active entry with a real costHandle, keyed by partition, and skips one without", async () => {
		const samples: Array<{ partitionKey: string; costHandle: unknown }> = [];
		const pool = new Pool<string, PooledResource>({
			maxActive: 4,
			costRecorder: { recordSample: (partitionKey, costHandle) => samples.push({ partitionKey, costHandle }) },
		});
		await pool.acquire("a", "typescript", () => fakeResource("ts", [], { costHandle: 1001 }));
		await pool.acquire("b", "go", () => fakeResource("go", [], { costHandle: 2002 }));
		await pool.acquire("c", "notreal", () => fakeResource("no-pid", [], { costHandle: undefined }));

		pool.calibrateCosts();

		expect(samples).toHaveLength(2);
		expect(samples).toContainEqual({ partitionKey: "typescript", costHandle: 1001 });
		expect(samples).toContainEqual({ partitionKey: "go", costHandle: 2002 });
	});

	it("calibrateCosts is a safe no-op without a configured recorder", async () => {
		const pool = new Pool<string, PooledResource>({});
		await pool.acquire("a", "lang", () => fakeResource("a", [], { costHandle: 42 }));
		expect(() => pool.calibrateCosts()).not.toThrow();
	});

	it("never samples an evicted/closed entry -- only what is currently active", async () => {
		const samples: Array<{ partitionKey: string; costHandle: unknown }> = [];
		const pool = new Pool<string, PooledResource>({
			costRecorder: { recordSample: (partitionKey, costHandle) => samples.push({ partitionKey, costHandle }) },
		});
		const lease = await pool.acquire("a", "lang", () => fakeResource("a", [], { costHandle: 42 }));
		await lease[Symbol.asyncDispose]();
		await pool.releaseOwnerIfIdle("a");

		pool.calibrateCosts();

		expect(samples).toEqual([]);
	});

	it("measures idle time from lease completion", async () => {
		let now = 100;
		const closed: string[] = [];
		const pool = new Pool<string, PooledResource>({ now: () => now });
		const lease = await pool.acquire("a", "lang", () => fakeResource("a", closed));
		now = 1_000;
		expect(await pool.reapIdle(10)).toBe(0);
		await lease[Symbol.asyncDispose]();
		now = 1_009;
		expect(await pool.reapIdle(10)).toBe(0);
		now = 1_011;
		expect(await pool.reapIdle(10)).toBe(1);
		expect(closed).toEqual(["a"]);
	});
});
