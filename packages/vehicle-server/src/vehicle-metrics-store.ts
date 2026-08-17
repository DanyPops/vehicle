/**
 * Durable, indexed, forever-retained record of every real Vehicle operation invocation this
 * daemon has served, plus every client-observed Vehicle Shell meta-tool call (tools_list/
 * tools_man/tools_type) reported into it -- one shared SQLite table, `source` distinguishing
 * the two. Built on storage.ts's portable SQLite bootstrap (bun:sqlite under Bun, node:sqlite
 * elsewhere), so this store works unmodified from any Vehicle daemon's own registry setup or
 * from vehicle-client-pi's own reporting path (see vehicle-metrics-middleware.ts and
 * vehicle-metrics-operations.ts).
 *
 * "Forever retention, queryable by time range" is exactly what an indexed timestamp column is
 * for -- not a periodic in-memory snapshot (which would lose per-invocation granularity and any
 * range narrower than the snapshot interval).
 *
 * Exported as raw source ("./metrics": "./src/vehicle-metrics-store.ts"), not built dist, same
 * reason as paths.ts/storage.ts themselves: this file's own Migration<Handle = Database> default
 * type parameter resolves to bun:sqlite's Database type, which needs "bun-types" in the consuming
 * tsconfig -- present in this package's own plain tsconfig.json (used by `tsc --noEmit`) but not
 * in the stricter tsconfig.build.json used to produce dist/, which was never previously reachable
 * from any file that imports storage.ts. Building this file would just move that same friction
 * from a devDependency choice into a real, harder-to-diagnose dist/ build failure.
 */
import { openSqliteWithPragmas, type Migration } from "./storage.js";

export type VehicleMetricsSource = "server" | "client";
export type VehicleMetricsOutcome = "success" | "failure";

export interface VehicleMetricsRecordInput {
	readonly source: VehicleMetricsSource;
	readonly vehicleName: string;
	/** A real operation name (e.g. "tasks.create") for source: "server", or a Vehicle Shell meta-tool name ("tools_list"/"tools_man"/"tools_type") for source: "client". */
	readonly toolName: string;
	/** Undefined for a Vehicle Shell meta-tool call (no single operation version applies). */
	readonly operationVersion?: number;
	readonly outcome: VehicleMetricsOutcome;
	/** Only meaningful when outcome is "failure". */
	readonly errorCode?: string;
	readonly durationMs?: number;
	readonly callerSessionId?: string;
	readonly callerProjectRoot?: string;
	readonly principalId?: string;
	/** Defaults to now(). Injectable for deterministic tests. */
	readonly ts?: number;
}

export type VehicleMetricsGroupDimension = "toolName" | "vehicleName" | "source" | "callerSessionId" | "outcome" | "day" | "hour";

export interface VehicleMetricsQuery {
	/** Epoch ms, inclusive. Omit for "since the beginning". */
	readonly since?: number;
	/** Epoch ms, exclusive. Omit for "through now". */
	readonly until?: number;
	readonly source?: VehicleMetricsSource;
	readonly toolName?: string;
	readonly vehicleName?: string;
	readonly callerSessionId?: string;
	/** Omit for one ungrouped total row. */
	readonly groupBy?: readonly VehicleMetricsGroupDimension[];
}

export interface VehicleMetricsSummaryRow {
	/** The requested groupBy dimensions' own values for this row; empty when the query had no groupBy. */
	readonly key: Readonly<Record<string, string>>;
	readonly count: number;
	readonly successCount: number;
	readonly failureCount: number;
	/** null when every matching row has no recorded duration. */
	readonly avgDurationMs: number | null;
}

export interface VehicleMetricsStore {
	record(input: VehicleMetricsRecordInput): void;
	query(query: VehicleMetricsQuery): readonly VehicleMetricsSummaryRow[];
	close(): void;
}

const MIGRATIONS: Migration[] = [
	{
		version: 1,
		up: (db) => {
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
			db.exec("CREATE INDEX idx_vehicle_tool_invocations_ts ON vehicle_tool_invocations(ts)");
			db.exec("CREATE INDEX idx_vehicle_tool_invocations_tool ON vehicle_tool_invocations(tool_name, ts)");
			db.exec("CREATE INDEX idx_vehicle_tool_invocations_session ON vehicle_tool_invocations(caller_session_id, ts)");
		},
	},
];

/** Maps a public groupBy dimension to the real SQL expression it groups by -- day/hour are derived from `ts`, the rest are plain columns. */
const GROUP_EXPRESSION: Readonly<Record<VehicleMetricsGroupDimension, string>> = {
	toolName: "tool_name",
	vehicleName: "vehicle_name",
	source: "source",
	callerSessionId: "caller_session_id",
	outcome: "outcome",
	day: "strftime('%Y-%m-%d', ts / 1000, 'unixepoch')",
	hour: "strftime('%Y-%m-%dT%H:00', ts / 1000, 'unixepoch')",
};

/** Column identifiers are drawn only from this module's own fixed GROUP_EXPRESSION map (never caller-supplied text), so building this string directly is safe -- not a SQL-injection surface despite the string interpolation. */
export function openVehicleMetricsStore(path: string, now: () => number = Date.now): VehicleMetricsStore {
	const db = openSqliteWithPragmas(path, { migrations: MIGRATIONS });
	const insert = db.query(`
		INSERT INTO vehicle_tool_invocations
			(ts, source, vehicle_name, tool_name, operation_version, outcome, error_code, duration_ms, caller_session_id, caller_project_root, principal_id)
		VALUES ($ts, $source, $vehicleName, $toolName, $operationVersion, $outcome, $errorCode, $durationMs, $callerSessionId, $callerProjectRoot, $principalId)
	`);

	return {
		record(input) {
			insert.run({
				$ts: input.ts ?? now(),
				$source: input.source,
				$vehicleName: input.vehicleName,
				$toolName: input.toolName,
				$operationVersion: input.operationVersion ?? null,
				$outcome: input.outcome,
				$errorCode: input.errorCode ?? null,
				$durationMs: input.durationMs ?? null,
				$callerSessionId: input.callerSessionId ?? null,
				$callerProjectRoot: input.callerProjectRoot ?? null,
				$principalId: input.principalId ?? null,
			});
		},

		query(q) {
			const where: string[] = [];
			const params: Record<string, string | number> = {};
			if (q.since !== undefined) {
				where.push("ts >= $since");
				params.$since = q.since;
			}
			if (q.until !== undefined) {
				where.push("ts < $until");
				params.$until = q.until;
			}
			if (q.source !== undefined) {
				where.push("source = $source");
				params.$source = q.source;
			}
			if (q.toolName !== undefined) {
				where.push("tool_name = $toolName");
				params.$toolName = q.toolName;
			}
			if (q.vehicleName !== undefined) {
				where.push("vehicle_name = $vehicleName");
				params.$vehicleName = q.vehicleName;
			}
			if (q.callerSessionId !== undefined) {
				where.push("caller_session_id = $callerSessionId");
				params.$callerSessionId = q.callerSessionId;
			}
			const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

			const groupBy = q.groupBy ?? [];
			const groupExpressions = groupBy.map((dimension) => GROUP_EXPRESSION[dimension]);
			const selectKeys = groupBy.map((dimension, index) => `${groupExpressions[index]} AS "${dimension}"`);
			const groupClause = groupExpressions.length > 0 ? `GROUP BY ${groupExpressions.join(", ")}` : "";

			const sql = `
				SELECT
					${selectKeys.length > 0 ? `${selectKeys.join(", ")},` : ""}
					COUNT(*) AS count,
					SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) AS successCount,
					SUM(CASE WHEN outcome = 'failure' THEN 1 ELSE 0 END) AS failureCount,
					AVG(duration_ms) AS avgDurationMs
				FROM vehicle_tool_invocations
				${whereClause}
				${groupClause}
			`;
			const rows = db.query(sql).all(params) as readonly Record<string, unknown>[];
			return rows.map((row) => {
				const key: Record<string, string> = {};
				for (const dimension of groupBy) key[dimension] = String(row[dimension] ?? "");
				return {
					key,
					count: Number(row.count),
					successCount: Number(row.successCount),
					failureCount: Number(row.failureCount),
					avgDurationMs: row.avgDurationMs === null || row.avgDurationMs === undefined ? null : Number(row.avgDurationMs),
				};
			});
		},

		close() {
			db.close();
		},
	};
}
