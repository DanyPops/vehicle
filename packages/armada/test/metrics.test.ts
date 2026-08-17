import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { queryVehicleMetrics, resolveVehicleMetricsPath } from "../src/fleet/metrics.js";

/** Seeds a real SQLite file with the exact vehicle_tool_invocations schema vehicle-server's own vehicle-metrics-store.ts creates -- this module reads it independently (see metrics.ts's own header comment on duplication), so the test proves compatibility against the real shape, not just this file's own internal consistency. */
function seedMetricsDb(
	path: string,
	rows: readonly {
		ts: number;
		source: "server" | "client";
		vehicleName: string;
		toolName: string;
		operationVersion?: number;
		outcome: "success" | "failure";
		errorCode?: string;
		durationMs?: number;
		callerSessionId?: string;
		callerProjectRoot?: string;
		principalId?: string;
	}[],
): void {
	const db = new Database(path, { create: true });
	db.exec(`
		CREATE TABLE vehicle_tool_invocations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			ts INTEGER NOT NULL,
			source TEXT NOT NULL,
			vehicle_name TEXT NOT NULL,
			tool_name TEXT NOT NULL,
			operation_version INTEGER,
			outcome TEXT NOT NULL,
			error_code TEXT,
			duration_ms INTEGER,
			caller_session_id TEXT,
			caller_project_root TEXT,
			principal_id TEXT
		)
	`);
	const insert = db.prepare(`
		INSERT INTO vehicle_tool_invocations
			(ts, source, vehicle_name, tool_name, operation_version, outcome, error_code, duration_ms, caller_session_id, caller_project_root, principal_id)
		VALUES ($ts, $source, $vehicleName, $toolName, $operationVersion, $outcome, $errorCode, $durationMs, $callerSessionId, $callerProjectRoot, $principalId)
	`);
	for (const row of rows) {
		insert.run({
			$ts: row.ts,
			$source: row.source,
			$vehicleName: row.vehicleName,
			$toolName: row.toolName,
			$operationVersion: row.operationVersion ?? null,
			$outcome: row.outcome,
			$errorCode: row.errorCode ?? null,
			$durationMs: row.durationMs ?? null,
			$callerSessionId: row.callerSessionId ?? null,
			$callerProjectRoot: row.callerProjectRoot ?? null,
			$principalId: row.principalId ?? null,
		});
	}
	db.close();
}

describe("resolveVehicleMetricsPath", () => {
	it("Linux: XDG_DATA_HOME/<vehicle>/metrics.sqlite", () => {
		expect(resolveVehicleMetricsPath("papyrus", "linux", { XDG_DATA_HOME: "/data" }, "/home/x")).toBe("/data/papyrus/metrics.sqlite");
	});

	it("Linux: falls back to ~/.local/share when XDG_DATA_HOME is unset", () => {
		expect(resolveVehicleMetricsPath("papyrus", "linux", {}, "/home/x")).toBe("/home/x/.local/share/papyrus/metrics.sqlite");
	});

	it("macOS: ~/Library/Application Support/<vehicle>/metrics.sqlite", () => {
		expect(resolveVehicleMetricsPath("papyrus", "darwin", {}, "/Users/x")).toBe("/Users/x/Library/Application Support/papyrus/metrics.sqlite");
	});

	it("Windows: %LOCALAPPDATA%/<vehicle>/Data/metrics.sqlite", () => {
		expect(resolveVehicleMetricsPath("papyrus", "win32", { LOCALAPPDATA: "C:\\Users\\x\\AppData\\Local" }, "C:\\Users\\x")).toBe(
			"C:\\Users\\x\\AppData\\Local\\papyrus\\Data\\metrics.sqlite",
		);
	});

	it("matches vehicle-server's own resolveDaemonPaths default metrics filename exactly", () => {
		// Cross-checked by literal string here rather than importing vehicle-server (circular) --
		// see this module's own header comment. If vehicle-server's own default ever changes,
		// this assertion (and the header comment) must be updated together.
		expect(resolveVehicleMetricsPath("acme", "linux", { XDG_DATA_HOME: "/data" }, "/home/x")).toBe("/data/acme/metrics.sqlite");
	});
});

describe("queryVehicleMetrics", () => {
	it("returns an empty array when the DB file doesn't exist yet -- not an error", () => {
		expect(queryVehicleMetrics("/tmp/definitely-does-not-exist-vehicle-metrics.sqlite", {})).toEqual([]);
	});

	it("reads real rows written in vehicle-server's own schema shape, ungrouped total", () => {
		const dir = mkdtempSync(join(tmpdir(), "armada-metrics-"));
		const path = join(dir, "metrics.sqlite");
		try {
			seedMetricsDb(path, [
				{ ts: 1_000, source: "server", vehicleName: "papyrus", toolName: "tasks.create", outcome: "success", durationMs: 10 },
				{ ts: 2_000, source: "server", vehicleName: "papyrus", toolName: "tasks.create", outcome: "failure", durationMs: 20 },
			]);
			const rows = queryVehicleMetrics(path, {});
			expect(rows).toEqual([{ key: {}, count: 2, successCount: 1, failureCount: 1, avgDurationMs: 15 }]);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("filters by since/until, toolName, source, and vehicleName", () => {
		const dir = mkdtempSync(join(tmpdir(), "armada-metrics-"));
		const path = join(dir, "metrics.sqlite");
		try {
			seedMetricsDb(path, [
				{ ts: 100, source: "server", vehicleName: "papyrus", toolName: "tasks.create", outcome: "success" },
				{ ts: 200, source: "client", vehicleName: "papyrus", toolName: "tools_list", outcome: "success" },
				{ ts: 300, source: "server", vehicleName: "tickets", toolName: "issue.get", outcome: "success" },
			]);
			expect(queryVehicleMetrics(path, { since: 200 })[0]?.count).toBe(2);
			expect(queryVehicleMetrics(path, { until: 200 })[0]?.count).toBe(1);
			expect(queryVehicleMetrics(path, { source: "client" })[0]?.count).toBe(1);
			expect(queryVehicleMetrics(path, { toolName: "tasks.create" })[0]?.count).toBe(1);
			expect(queryVehicleMetrics(path, { vehicleName: "tickets" })[0]?.count).toBe(1);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("groups by one or more dimensions", () => {
		const dir = mkdtempSync(join(tmpdir(), "armada-metrics-"));
		const path = join(dir, "metrics.sqlite");
		try {
			seedMetricsDb(path, [
				{ ts: 1, source: "server", vehicleName: "papyrus", toolName: "tasks.create", outcome: "success" },
				{ ts: 2, source: "server", vehicleName: "papyrus", toolName: "tasks.create", outcome: "success" },
				{ ts: 3, source: "server", vehicleName: "papyrus", toolName: "docs.list", outcome: "failure" },
			]);
			const byTool = queryVehicleMetrics(path, { groupBy: ["toolName"] });
			const byToolMap = new Map(byTool.map((row) => [row.key["toolName"], row]));
			expect(byToolMap.get("tasks.create")).toMatchObject({ count: 2, successCount: 2 });
			expect(byToolMap.get("docs.list")).toMatchObject({ count: 1, failureCount: 1 });
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("never writes to the file -- read-only regardless of what's asked", () => {
		const dir = mkdtempSync(join(tmpdir(), "armada-metrics-"));
		const path = join(dir, "metrics.sqlite");
		try {
			seedMetricsDb(path, [{ ts: 1, source: "server", vehicleName: "v", toolName: "op", outcome: "success" }]);
			queryVehicleMetrics(path, {});
			queryVehicleMetrics(path, { groupBy: ["toolName"] });
			// Re-open directly and confirm row count is unchanged -- queryVehicleMetrics never inserted/mutated anything.
			const check = new Database(path, { readonly: true });
			const count = (check.prepare("SELECT COUNT(*) as n FROM vehicle_tool_invocations").get() as { n: number }).n;
			check.close();
			expect(count).toBe(1);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
