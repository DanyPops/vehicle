import { describe, expect, it } from "bun:test";
import { BoundedResourcePool as Pool, type PooledResource } from "../../src/resource-pool/bounded-resource-pool.js";
import type { ResourcePoolResourcePolicy } from "../../src/resource-pool/resource-policy.js";

interface FakeStatus {
	readonly customField: string;
}

function fakeResource(label: string, closed: string[]): PooledResource {
	return {
		async close() {
			closed.push(label);
		},
	};
}

function fakePolicy(overrides: Partial<ResourcePoolResourcePolicy<FakeStatus>> = {}): ResourcePoolResourcePolicy<FakeStatus> {
	return {
		canAdmit: () => true,
		isOverBudget: () => false,
		softActiveCeiling: () => undefined,
		maxIdleMs: (configured) => configured,
		status: () => ({ customField: "opaque-value" }),
		...overrides,
	};
}

describe("BoundedResourcePool resource policy", () => {
	it("evicts an idle resource when canAdmit reports no room, rather than growing past budget", async () => {
		const closed: string[] = [];
		let admitCalls = 0;
		// Call 1 admits "a" (nothing to deny yet). Call 2 (second acquire's first check) denies,
		// forcing an eviction; call 3 (the re-check after eviction) admits "b".
		const policy = fakePolicy({
			canAdmit: () => {
				admitCalls++;
				return admitCalls !== 2;
			},
		});
		const pool = new Pool<string, PooledResource>({ maxActive: 4, resourcePolicy: policy });
		const first = await pool.acquire("a", "lang", () => fakeResource("a", closed));
		await first[Symbol.asyncDispose]();

		await using _second = await pool.acquire("b", "lang", () => fakeResource("b", closed));

		expect(closed).toEqual(["a"]);
	});

	it("softActiveCeiling raises the effective ceiling above maxActive, clamped to absoluteMaxActive", async () => {
		const closed: string[] = [];
		const policy = fakePolicy({ softActiveCeiling: () => 10 });
		// partitionLimits isolates the global ceiling from the default per-partition cap (which
		// otherwise defaults to maxActive and would itself block a 3rd same-partition admission).
		const pool = new Pool<string, PooledResource>({ maxActive: 2, absoluteMaxActive: 5, partitionLimits: { lang: 10 }, resourcePolicy: policy });

		await pool.acquire("a", "lang", () => fakeResource("a", closed));
		await pool.acquire("b", "lang", () => fakeResource("b", closed));
		await using _third = await pool.acquire("c", "lang", () => fakeResource("c", closed));

		const status = pool.status();
		expect(status.active).toBe(3);
		expect(status.effectiveMaxActive).toBe(5);
		expect(status.activeCeilingSource).toBe("absolute-cap");
	});

	it("falls back to configured maxActive when softActiveCeiling reports no room above it", async () => {
		const policy = fakePolicy({ softActiveCeiling: () => 1 });
		const pool = new Pool<string, PooledResource>({ maxActive: 2, resourcePolicy: policy });
		await pool.acquire("a", "lang", () => fakeResource("a", []));
		expect(pool.status().activeCeilingSource).toBe("configured");
		expect(pool.status().effectiveMaxActive).toBe(2);
	});

	it("isOverBudget drives reconcileResources to evict idle entries proactively", async () => {
		const closed: string[] = [];
		// Starts false so dispose()'s own internal reconcileResources() call (every lease release
		// triggers one) does not already evict "a" before this test gets to assert on an explicit call.
		let overBudget = false;
		const policy = fakePolicy({ isOverBudget: () => overBudget });
		const pool = new Pool<string, PooledResource>({ maxActive: 4, resourcePolicy: policy });
		const lease = await pool.acquire("a", "lang", () => fakeResource("a", closed));
		await lease[Symbol.asyncDispose]();
		expect(closed).toEqual([]); // confirms dispose's own reconcile did nothing while under budget

		overBudget = true;
		expect(await pool.reconcileResources()).toBe(1);
		expect(closed).toEqual(["a"]);

		overBudget = false;
		expect(await pool.reconcileResources()).toBe(0);
	});

	it("maxIdleMs lets the policy shorten or lengthen the effective idle window", async () => {
		let now = 0;
		const closed: string[] = [];
		const policy = fakePolicy({ maxIdleMs: () => 5 }); // policy overrides the configured 1000 down to 5
		const pool = new Pool<string, PooledResource>({ now: () => now, resourcePolicy: policy });
		const lease = await pool.acquire("a", "lang", () => fakeResource("a", closed));
		await lease[Symbol.asyncDispose]();
		now = 10;

		expect(await pool.reapIdle(1_000)).toBe(1);
		expect(closed).toEqual(["a"]);
	});

	it("forwards the policy's own status() shape verbatim, opaque to the pool itself", async () => {
		const pool = new Pool<string, PooledResource, FakeStatus>({ resourcePolicy: fakePolicy() });
		await pool.acquire("a", "lang", () => fakeResource("a", []));

		expect(pool.status().resources).toEqual({ customField: "opaque-value" });
	});

	it("status().resources is omitted entirely without a configured resource policy", async () => {
		const pool = new Pool<string, PooledResource>({});
		await pool.acquire("a", "lang", () => fakeResource("a", []));

		expect(pool.status().resources).toBeUndefined();
		expect("resources" in pool.status()).toBe(false);
	});
});
