import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openVehicleMetricsStore } from "../src/vehicle-metrics-store.ts";

describe("VehicleMetricsStore", () => {
	it("records and queries a single invocation, ungrouped", () => {
		const store = openVehicleMetricsStore(":memory:", () => 1_000);
		store.record({ source: "server", vehicleName: "papyrus", toolName: "tasks.create", operationVersion: 1, outcome: "success", durationMs: 42 });
		const rows = store.query({});
		expect(rows).toEqual([{ key: {}, count: 1, successCount: 1, failureCount: 0, avgDurationMs: 42 }]);
		store.close();
	});

	it("counts success and failure separately within the same ungrouped total", () => {
		const store = openVehicleMetricsStore(":memory:", () => 1_000);
		store.record({ source: "server", vehicleName: "papyrus", toolName: "tasks.create", outcome: "success" });
		store.record({ source: "server", vehicleName: "papyrus", toolName: "tasks.create", outcome: "failure", errorCode: "not-found" });
		store.record({ source: "server", vehicleName: "papyrus", toolName: "tasks.create", outcome: "success" });
		const rows = store.query({});
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ count: 3, successCount: 2, failureCount: 1 });
		store.close();
	});

	it("filters to only rows within [since, until) -- since inclusive, until exclusive", () => {
		const store = openVehicleMetricsStore(":memory:");
		store.record({ source: "server", vehicleName: "v", toolName: "op", outcome: "success", ts: 100 });
		store.record({ source: "server", vehicleName: "v", toolName: "op", outcome: "success", ts: 200 });
		store.record({ source: "server", vehicleName: "v", toolName: "op", outcome: "success", ts: 300 });

		expect(store.query({ since: 200 })[0]?.count).toBe(2); // 200, 300
		expect(store.query({ until: 200 })[0]?.count).toBe(1); // 100 only -- 200 is excluded
		expect(store.query({ since: 100, until: 300 })[0]?.count).toBe(2); // 100, 200
		store.close();
	});

	it("filters by source, toolName, vehicleName, and callerSessionId", () => {
		const store = openVehicleMetricsStore(":memory:");
		store.record({ source: "server", vehicleName: "papyrus", toolName: "tasks.create", outcome: "success", callerSessionId: "s1" });
		store.record({ source: "client", vehicleName: "papyrus", toolName: "tools_list", outcome: "success", callerSessionId: "s2" });
		store.record({ source: "server", vehicleName: "tickets", toolName: "issue.get", outcome: "success", callerSessionId: "s1" });

		expect(store.query({ source: "client" })[0]?.count).toBe(1);
		expect(store.query({ toolName: "tasks.create" })[0]?.count).toBe(1);
		expect(store.query({ vehicleName: "tickets" })[0]?.count).toBe(1);
		expect(store.query({ callerSessionId: "s1" })[0]?.count).toBe(2);
		store.close();
	});

	it("groups by a single dimension, one row per distinct value", () => {
		const store = openVehicleMetricsStore(":memory:");
		store.record({ source: "server", vehicleName: "v", toolName: "a", outcome: "success" });
		store.record({ source: "server", vehicleName: "v", toolName: "a", outcome: "success" });
		store.record({ source: "server", vehicleName: "v", toolName: "b", outcome: "failure" });

		const rows = store.query({ groupBy: ["toolName"] });
		const byTool = new Map(rows.map((row) => [row.key.toolName, row]));
		expect(byTool.get("a")).toMatchObject({ count: 2, successCount: 2, failureCount: 0 });
		expect(byTool.get("b")).toMatchObject({ count: 1, successCount: 0, failureCount: 1 });
		store.close();
	});

	it("groups by more than one dimension at once", () => {
		const store = openVehicleMetricsStore(":memory:");
		store.record({ source: "server", vehicleName: "papyrus", toolName: "tasks.create", outcome: "success" });
		store.record({ source: "client", vehicleName: "papyrus", toolName: "tools_list", outcome: "success" });
		const rows = store.query({ groupBy: ["vehicleName", "source"] });
		expect(rows).toHaveLength(2);
		expect(rows).toContainEqual({ key: { vehicleName: "papyrus", source: "server" }, count: 1, successCount: 1, failureCount: 0, avgDurationMs: null });
		expect(rows).toContainEqual({ key: { vehicleName: "papyrus", source: "client" }, count: 1, successCount: 1, failureCount: 0, avgDurationMs: null });
		store.close();
	});

	it("groups by day/hour buckets derived from ts", () => {
		const store = openVehicleMetricsStore(":memory:");
		const day1 = Date.UTC(2026, 0, 1, 10, 0, 0);
		const day1LaterSameHour = Date.UTC(2026, 0, 1, 10, 30, 0);
		const day2 = Date.UTC(2026, 0, 2, 10, 0, 0);
		store.record({ source: "server", vehicleName: "v", toolName: "op", outcome: "success", ts: day1 });
		store.record({ source: "server", vehicleName: "v", toolName: "op", outcome: "success", ts: day1LaterSameHour });
		store.record({ source: "server", vehicleName: "v", toolName: "op", outcome: "success", ts: day2 });

		const byDay = store.query({ groupBy: ["day"] });
		expect(byDay).toHaveLength(2);
		expect(byDay.find((row) => row.key.day === "2026-01-01")?.count).toBe(2);
		expect(byDay.find((row) => row.key.day === "2026-01-02")?.count).toBe(1);

		const byHour = store.query({ groupBy: ["hour"] });
		expect(byHour).toHaveLength(2); // the two day-1 rows share the same hour bucket
		store.close();
	});

	it("avgDurationMs is null when no matching row recorded a duration", () => {
		const store = openVehicleMetricsStore(":memory:");
		store.record({ source: "server", vehicleName: "v", toolName: "op", outcome: "success" });
		expect(store.query({})[0]?.avgDurationMs).toBeNull();
		store.close();
	});

	it("avgDurationMs averages only over rows that recorded one", () => {
		const store = openVehicleMetricsStore(":memory:");
		store.record({ source: "server", vehicleName: "v", toolName: "op", outcome: "success", durationMs: 10 });
		store.record({ source: "server", vehicleName: "v", toolName: "op", outcome: "success", durationMs: 30 });
		store.record({ source: "server", vehicleName: "v", toolName: "op", outcome: "success" }); // no duration -- excluded from the average, not treated as 0
		expect(store.query({})[0]?.avgDurationMs).toBe(20);
		store.close();
	});

	it("persists across a close/reopen of the same file path", () => {
		const dir = mkdtempSync(join(tmpdir(), "vehicle-metrics-store-"));
		const path = join(dir, "metrics.sqlite");
		try {
			const store1 = openVehicleMetricsStore(path);
			store1.record({ source: "server", vehicleName: "v", toolName: "op", outcome: "success" });
			store1.close();

			const store2 = openVehicleMetricsStore(path);
			expect(store2.query({})[0]?.count).toBe(1);
			store2.close();
		} finally {
			// Best-effort, never fails the test over cleanup alone -- confirmed live on a real
			// windows-latest CI run of armada's own equivalent test: a just-closed bun:sqlite handle
			// can hold its containing directory locked (EBUSY) well past its own close() call
			// returning, and not just briefly -- rmSync's own maxRetries/retryDelay (up to 500ms)
			// still wasn't always enough there. This suite is currently ubuntu-only in CI, but the
			// fix costs nothing to apply here too rather than waiting to rediscover it later.
			try {
				rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
			} catch (error) {
				console.warn(`vehicle-metrics-store.test.ts: best-effort cleanup of "${dir}" failed (leaving it for the OS/CI runner to reclaim):`, error);
			}
		}
	});

	it("defaults ts to the injected now() when not explicitly given", () => {
		let current = 5_000;
		const store = openVehicleMetricsStore(":memory:", () => current);
		store.record({ source: "server", vehicleName: "v", toolName: "op", outcome: "success" });
		current = 15_000;
		store.record({ source: "server", vehicleName: "v", toolName: "op", outcome: "success" });
		expect(store.query({ until: 10_000 })[0]?.count).toBe(1);
		expect(store.query({ since: 10_000 })[0]?.count).toBe(1);
		store.close();
	});
});
