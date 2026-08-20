/**
 * The starvation guard: a background admission must never be able to grow the pool past
 * reservedForegroundSlots' reduced ceiling, and must queue (bounded, cancellable) rather than
 * either blocking the shared admission lock or hard-failing instantly. Foreground admission is
 * never subject to the reduced ceiling or the queue at all.
 */
import { describe, expect, it } from "bun:test";
import {
	BoundedResourcePool as Pool,
	type PooledResource,
	ResourceAdmissionQueueFull,
	ResourceAdmissionQueueTimedOut,
} from "../../src/resource-pool/bounded-resource-pool.js";

function fakeResource(label: string, closed: string[]): PooledResource {
	return {
		async close() {
			closed.push(label);
		},
	};
}

function elapsedMs(startedAt: number): number {
	return Date.now() - startedAt;
}

describe("BoundedResourcePool foreground reservation", () => {
	it("caps background admission below maxActive while foreground keeps using the full capacity", async () => {
		const closed: string[] = [];
		const pool = new Pool<string, PooledResource>({ maxActive: 2, reservedForegroundSlots: 1, backgroundAdmissionQueueTimeoutMs: 40 });

		const background = await pool.acquire("bg-a", "lang", () => fakeResource("bg-a", closed), "background");

		await expect(pool.acquire("bg-b", "lang", () => fakeResource("bg-b", closed), "background")).rejects.toBeInstanceOf(
			ResourceAdmissionQueueTimedOut,
		);

		await using foreground = await pool.acquire("fg-a", "lang", () => fakeResource("fg-a", closed));
		expect(foreground.value).toBeDefined();
		expect(pool.status().active).toBe(2);

		await background[Symbol.asyncDispose]();
	});

	it("admits a queued background request promptly once the reserved-adjacent slot actually frees, instead of waiting out the full timeout", async () => {
		const closed: string[] = [];
		// partitionLimits isolates the global ceiling from the default per-partition cap (which
		// otherwise defaults to maxActive and would itself block a 2nd same-partition admission).
		const pool = new Pool<string, PooledResource>({
			maxActive: 1,
			partitionLimits: { lang: 10 },
			reservedForegroundSlots: 0,
			backgroundAdmissionQueueTimeoutMs: 2_000,
		});

		const first = await pool.acquire("bg-a", "lang", () => fakeResource("bg-a", closed), "background");
		const startedAt = Date.now();
		const queued = pool.acquire("bg-b", "lang", () => fakeResource("bg-b", closed), "background");

		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(pool.waitingForAdmission("bg-b")).toBe(true);
		await first[Symbol.asyncDispose]();

		await using second = await queued;
		expect(second.value).toBeDefined();
		expect(elapsedMs(startedAt)).toBeLessThan(1_000); // woke on release, not the 2s timeout
		expect(pool.waitingForAdmission("bg-b")).toBe(false);
	});

	it("fails fast with ResourceAdmissionQueueFull once the wait queue itself is at capacity, rather than growing it further", async () => {
		const closed: string[] = [];
		const pool = new Pool<string, PooledResource>({
			maxActive: 1,
			partitionLimits: { lang: 10 },
			reservedForegroundSlots: 0,
			backgroundAdmissionQueueTimeoutMs: 200,
			maxQueuedBackgroundAdmissions: 1,
		});

		await using held = await pool.acquire("bg-a", "lang", () => fakeResource("bg-a", closed), "background");
		expect(held.value).toBeDefined();
		const firstQueued = pool.acquire("bg-b", "lang", () => fakeResource("bg-b", closed), "background");
		await new Promise((resolve) => setTimeout(resolve, 10)); // let firstQueued actually enter the wait

		await expect(pool.acquire("bg-c", "lang", () => fakeResource("bg-c", closed), "background")).rejects.toBeInstanceOf(ResourceAdmissionQueueFull);

		await expect(firstQueued).rejects.toBeInstanceOf(ResourceAdmissionQueueTimedOut);
	});

	it("reports waitingBackgroundAdmissions in pool status while a background request is queued", async () => {
		const closed: string[] = [];
		const pool = new Pool<string, PooledResource>({ maxActive: 1, partitionLimits: { lang: 10 }, backgroundAdmissionQueueTimeoutMs: 60 });

		await using held = await pool.acquire("bg-a", "lang", () => fakeResource("bg-a", closed), "background");
		expect(held.value).toBeDefined();
		expect(pool.status().waitingBackgroundAdmissions).toBe(0);
		const queued = pool.acquire("bg-b", "lang", () => fakeResource("bg-b", closed), "background");
		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(pool.status().waitingBackgroundAdmissions).toBe(1);
		await expect(queued).rejects.toBeInstanceOf(ResourceAdmissionQueueTimedOut);
		expect(pool.status().waitingBackgroundAdmissions).toBe(0);
	});

	it("never queues foreground admission even while background waits at the same reduced ceiling", async () => {
		const closed: string[] = [];
		const pool = new Pool<string, PooledResource>({
			maxActive: 3,
			partitionLimits: { lang: 3 },
			reservedForegroundSlots: 1,
			backgroundAdmissionQueueTimeoutMs: 2_000,
		});

		const bg1 = await pool.acquire("bg-1", "lang", () => fakeResource("bg-1", closed), "background");
		const bg2 = await pool.acquire("bg-2", "lang", () => fakeResource("bg-2", closed), "background");
		const bg3 = pool.acquire("bg-3", "lang", () => fakeResource("bg-3", closed), "background");
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(pool.waitingForAdmission("bg-3")).toBe(true);

		const startedAt = Date.now();
		await using foreground = await pool.acquire("fg-1", "lang", () => fakeResource("fg-1", closed));
		expect(foreground.value).toBeDefined();
		expect(elapsedMs(startedAt)).toBeLessThan(200);

		await Promise.all([bg1[Symbol.asyncDispose](), bg2[Symbol.asyncDispose]()]);
		await using resolvedBg3 = await bg3;
		expect(resolvedBg3.value).toBeDefined();
	});

	it("preserves default behavior when reservedForegroundSlots is left at its default of 0", async () => {
		const closed: string[] = [];
		const pool = new Pool<string, PooledResource>({ maxActive: 1 });

		await using bg = await pool.acquire("bg-a", "lang", () => fakeResource("bg-a", closed), "background");
		expect(bg.value).toBeDefined();
		expect(pool.status()).toMatchObject({ active: 1, maxActive: 1, waitingBackgroundAdmissions: 0 });
	});
});
