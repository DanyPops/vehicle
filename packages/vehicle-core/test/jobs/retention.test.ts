import { describe, expect, it } from "bun:test";
import { selectVehicleJobsForEviction } from "../../src/jobs/retention.ts";

describe("selectVehicleJobsForEviction", () => {
	it("never evicts a running job, regardless of the cap", () => {
		const evicted = selectVehicleJobsForEviction([{ jobId: "a", status: "running", delivered: false, updatedAt: 0 }], {
			maxRetainedJobs: 0,
			deliveredRetentionMs: 0,
			now: 1_000,
		});
		expect(evicted).toEqual([]);
	});

	it("evicts a delivered terminal job once it's past deliveredRetentionMs, even under the cap", () => {
		const evicted = selectVehicleJobsForEviction(
			[
				{ jobId: "old", status: "succeeded", delivered: true, updatedAt: 0 },
				{ jobId: "new", status: "succeeded", delivered: true, updatedAt: 900 },
			],
			{ maxRetainedJobs: 100, deliveredRetentionMs: 1_000, now: 1_000 },
		);
		expect(evicted).toEqual(["old"]);
	});

	it("prefers evicting delivered jobs, oldest first, once over the cap", () => {
		const evicted = selectVehicleJobsForEviction(
			[
				{ jobId: "undelivered", status: "succeeded", delivered: false, updatedAt: 0 },
				{ jobId: "delivered-older", status: "succeeded", delivered: true, updatedAt: 100 },
				{ jobId: "delivered-newer", status: "succeeded", delivered: true, updatedAt: 200 },
			],
			{ maxRetainedJobs: 2, deliveredRetentionMs: 1_000_000, now: 1_000 },
		);
		expect(evicted).toEqual(["delivered-older"]);
	});

	it("falls back to evicting an undelivered terminal job, oldest first, only once no delivered job remains", () => {
		const evicted = selectVehicleJobsForEviction(
			[
				{ jobId: "undelivered-older", status: "failed", delivered: false, updatedAt: 0 },
				{ jobId: "undelivered-newer", status: "failed", delivered: false, updatedAt: 100 },
			],
			{ maxRetainedJobs: 1, deliveredRetentionMs: 1_000_000, now: 1_000 },
		);
		expect(evicted).toEqual(["undelivered-older"]);
	});

	it("does nothing when at or under the cap and nothing is past its delivered-retention window", () => {
		const evicted = selectVehicleJobsForEviction(
			[
				{ jobId: "a", status: "succeeded", delivered: true, updatedAt: 900 },
				{ jobId: "b", status: "running", delivered: false, updatedAt: 950 },
			],
			{ maxRetainedJobs: 10, deliveredRetentionMs: 1_000, now: 1_000 },
		);
		expect(evicted).toEqual([]);
	});
});
