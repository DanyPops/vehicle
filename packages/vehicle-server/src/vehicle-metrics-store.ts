import { createHmac, randomBytes } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== "undefined";

/** Satisfied structurally by both bun:sqlite's Database and node:sqlite's DatabaseSync. */
interface MinimalDatabase {
	exec(sql: string): void;
	prepare(sql: string): {
		get(params?: Record<string, unknown>): unknown;
		all(params?: Record<string, unknown>): unknown[];
		run(params?: Record<string, unknown>): unknown;
	};
	close(): void;
}

function openDatabase(path: string): MinimalDatabase {
	if (isBun) {
		const bunSqlite = require("bun:sqlite") as { Database: new (path: string, options?: { create?: boolean }) => MinimalDatabase };
		return new bunSqlite.Database(path, { create: true });
	}
	const nodeSqlite = require("node:sqlite") as { DatabaseSync: new (path: string) => MinimalDatabase };
	return new nodeSqlite.DatabaseSync(path);
}

const SCHEMA_VERSION = 2;
const DEFAULT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1_000;
const DEFAULT_MAX_ROWS = 100_000;
const DEFAULT_QUERY_LIMIT = 100;
const MAX_QUERY_LIMIT = 1_000;

const CREATE_TABLE_SQL = `
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
		principal_id TEXT
	)
`;

function createIndexes(db: MinimalDatabase): void {
	db.exec("CREATE INDEX idx_vehicle_tool_invocations_ts ON vehicle_tool_invocations(ts)");
	db.exec("CREATE INDEX idx_vehicle_tool_invocations_tool ON vehicle_tool_invocations(tool_name, ts)");
	db.exec("CREATE INDEX idx_vehicle_tool_invocations_session ON vehicle_tool_invocations(caller_session_id, ts)");
}

function identitySalt(db: MinimalDatabase): string {
	db.exec("CREATE TABLE IF NOT EXISTS vehicle_metrics_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
	const existing = db.prepare("SELECT value FROM vehicle_metrics_metadata WHERE key = 'identity_salt'").get() as { value?: unknown } | undefined;
	if (typeof existing?.value === "string" && existing.value.length >= 32) return existing.value;
	const value = randomBytes(32).toString("hex");
	db.prepare("INSERT OR REPLACE INTO vehicle_metrics_metadata (key, value) VALUES ('identity_salt', $value)").run({ $value: value });
	return value;
}

/** Migrates the original schema by copying its safe fields and dropping the raw project-root column. */
function bootstrapDatabase(path: string): MinimalDatabase {
	const db = openDatabase(path);
	db.exec("PRAGMA foreign_keys = ON");
	db.exec("PRAGMA busy_timeout = 5000");
	if (path !== ":memory:") db.exec("PRAGMA journal_mode = WAL");
	const currentVersion = (db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
	if (currentVersion === 0) {
		db.exec(CREATE_TABLE_SQL);
		createIndexes(db);
		db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
	} else if (currentVersion === 1) {
		db.exec("BEGIN IMMEDIATE");
		try {
			db.exec("ALTER TABLE vehicle_tool_invocations RENAME TO vehicle_tool_invocations_v1");
			db.exec(CREATE_TABLE_SQL);
			db.exec(`
				INSERT INTO vehicle_tool_invocations
					(id, ts, source, vehicle_name, tool_name, operation_version, outcome, error_code, duration_ms, caller_session_id, principal_id)
				SELECT id, ts, source, vehicle_name, tool_name, operation_version, outcome, error_code, duration_ms, NULL, NULL
				FROM vehicle_tool_invocations_v1
			`);
			db.exec("DROP TABLE vehicle_tool_invocations_v1");
			createIndexes(db);
			db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
			db.exec("COMMIT");
		} catch (error) {
			db.exec("ROLLBACK");
			throw error;
		}
	} else if (currentVersion !== SCHEMA_VERSION) {
		db.close();
		throw new Error(`unsupported Vehicle metrics schema version ${currentVersion}`);
	}
	return db;
}

export type VehicleMetricsSource = "server" | "client";
export type VehicleMetricsOutcome = "success" | "failure";

export interface VehicleMetricsRecordInput {
	readonly source: VehicleMetricsSource;
	readonly vehicleName: string;
	readonly toolName: string;
	readonly operationVersion?: number;
	readonly outcome: VehicleMetricsOutcome;
	readonly errorCode?: string;
	readonly durationMs?: number;
	readonly callerSessionId?: string;
	readonly principalId?: string;
	readonly ts?: number;
}

export type VehicleMetricsGroupDimension = "toolName" | "vehicleName" | "source" | "callerSessionId" | "outcome" | "errorCode" | "day" | "hour";

export interface VehicleMetricsQuery {
	readonly since?: number;
	readonly until?: number;
	readonly source?: VehicleMetricsSource;
	readonly toolName?: string;
	readonly vehicleName?: string;
	readonly callerSessionId?: string;
	readonly groupBy?: readonly VehicleMetricsGroupDimension[];
	readonly limit?: number;
}

export interface VehicleMetricsDurationHistogram {
	readonly le10: number;
	readonly le50: number;
	readonly le100: number;
	readonly le500: number;
	readonly le1000: number;
	readonly gt1000: number;
}

export interface VehicleMetricsSummaryRow {
	readonly key: Readonly<Record<string, string>>;
	readonly count: number;
	readonly successCount: number;
	readonly failureCount: number;
	readonly avgDurationMs: number | null;
	readonly durationHistogram: VehicleMetricsDurationHistogram;
}

export interface VehicleMetricsQueryResult {
	readonly rows: readonly VehicleMetricsSummaryRow[];
	readonly limit: number;
	readonly truncated: boolean;
}

export interface VehicleMetricsStoreOptions {
	readonly maxAgeMs?: number;
	readonly maxRows?: number;
	readonly queryDefaultLimit?: number;
	readonly queryMaxLimit?: number;
}

export interface VehicleMetricsStore {
	record(input: VehicleMetricsRecordInput): void;
	/** Compatibility projection for callers that only need aggregate rows. */
	query(query: VehicleMetricsQuery): readonly VehicleMetricsSummaryRow[];
	queryResult(query: VehicleMetricsQuery): VehicleMetricsQueryResult;
	close(): void;
}

const GROUP_EXPRESSION: Readonly<Record<VehicleMetricsGroupDimension, string>> = {
	toolName: "tool_name",
	vehicleName: "vehicle_name",
	source: "source",
	callerSessionId: "caller_session_id",
	outcome: "outcome",
	errorCode: "error_code",
	day: "strftime('%Y-%m-%d', ts / 1000, 'unixepoch')",
	hour: "strftime('%Y-%m-%dT%H:00', ts / 1000, 'unixepoch')",
};

function positiveInteger(value: number, name: string): number {
	if (!Number.isSafeInteger(value) || value <= 0) throw new RangeError(`${name} must be a positive safe integer`);
	return value;
}

function normalizeErrorCode(value: string | undefined): string | null {
	if (value === undefined) return null;
	return /^[a-z0-9][a-z0-9._-]{0,63}$/.test(value) ? value : "other";
}

/** Opens a portable SQLite metrics store with finite retention and query defaults. */
export function openVehicleMetricsStore(path: string, now: () => number = Date.now, options: VehicleMetricsStoreOptions = {}): VehicleMetricsStore {
	const maxAgeMs = positiveInteger(options.maxAgeMs ?? DEFAULT_MAX_AGE_MS, "maxAgeMs");
	const maxRows = positiveInteger(options.maxRows ?? DEFAULT_MAX_ROWS, "maxRows");
	const queryMaxLimit = positiveInteger(options.queryMaxLimit ?? MAX_QUERY_LIMIT, "queryMaxLimit");
	const queryDefaultLimit = positiveInteger(options.queryDefaultLimit ?? DEFAULT_QUERY_LIMIT, "queryDefaultLimit");
	if (queryDefaultLimit > queryMaxLimit) throw new RangeError("queryDefaultLimit must be less than or equal to queryMaxLimit");

	const db = bootstrapDatabase(path);
	const salt = identitySalt(db);
	const pseudonymize = (value: string | undefined): string | null =>
		value === undefined ? null : `hmac-sha256:${createHmac("sha256", salt).update(value).digest("hex")}`;
	const insert = db.prepare(`
		INSERT INTO vehicle_tool_invocations
			(ts, source, vehicle_name, tool_name, operation_version, outcome, error_code, duration_ms, caller_session_id, principal_id)
		VALUES ($ts, $source, $vehicleName, $toolName, $operationVersion, $outcome, $errorCode, $durationMs, $callerSessionId, $principalId)
	`);
	const pruneAge = db.prepare("DELETE FROM vehicle_tool_invocations WHERE ts < $cutoff");
	const pruneRows = db.prepare(`
		DELETE FROM vehicle_tool_invocations
		WHERE id NOT IN (SELECT id FROM vehicle_tool_invocations ORDER BY ts DESC, id DESC LIMIT $maxRows)
	`);

	function prune(): void {
		pruneAge.run({ $cutoff: now() - maxAgeMs });
		pruneRows.run({ $maxRows: maxRows });
	}

	function queryResult(q: VehicleMetricsQuery): VehicleMetricsQueryResult {
		const requestedLimit = q.limit === undefined ? queryDefaultLimit : positiveInteger(q.limit, "limit");
		const limit = Math.min(requestedLimit, queryMaxLimit);
		const where: string[] = [];
		const params: Record<string, string | number> = { $rowLimit: limit + 1 };
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
			params.$callerSessionId = pseudonymize(q.callerSessionId) ?? "";
		}
		const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
		const groupBy = q.groupBy ?? [];
		const groupExpressions = groupBy.map((dimension) => GROUP_EXPRESSION[dimension]);
		const selectKeys = groupBy.map((dimension, index) => `${groupExpressions[index]} AS "${dimension}"`);
		const groupClause = groupExpressions.length > 0 ? `GROUP BY ${groupExpressions.join(", ")}` : "";
		const orderClause = groupBy.length > 0 ? `ORDER BY ${groupBy.map((dimension) => `"${dimension}"`).join(", ")}` : "";
		const rows = db
			.prepare(`
				SELECT
					${selectKeys.length > 0 ? `${selectKeys.join(", ")},` : ""}
					COUNT(*) AS count,
					SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) AS successCount,
					SUM(CASE WHEN outcome = 'failure' THEN 1 ELSE 0 END) AS failureCount,
					AVG(duration_ms) AS avgDurationMs,
					SUM(CASE WHEN duration_ms <= 10 THEN 1 ELSE 0 END) AS durationLe10,
					SUM(CASE WHEN duration_ms <= 50 THEN 1 ELSE 0 END) AS durationLe50,
					SUM(CASE WHEN duration_ms <= 100 THEN 1 ELSE 0 END) AS durationLe100,
					SUM(CASE WHEN duration_ms <= 500 THEN 1 ELSE 0 END) AS durationLe500,
					SUM(CASE WHEN duration_ms <= 1000 THEN 1 ELSE 0 END) AS durationLe1000,
					SUM(CASE WHEN duration_ms > 1000 THEN 1 ELSE 0 END) AS durationGt1000
				FROM vehicle_tool_invocations
				${whereClause}
				${groupClause}
				${orderClause}
				LIMIT $rowLimit
			`)
			.all(params) as readonly Record<string, unknown>[];
		const truncated = rows.length > limit;
		return {
			limit,
			truncated,
			rows: rows.slice(0, limit).map((row) => {
				const key: Record<string, string> = {};
				for (const dimension of groupBy) key[dimension] = String(row[dimension] ?? "");
				return {
					key,
					count: Number(row.count),
					successCount: Number(row.successCount),
					failureCount: Number(row.failureCount),
					avgDurationMs: row.avgDurationMs === null || row.avgDurationMs === undefined ? null : Number(row.avgDurationMs),
					durationHistogram: {
						le10: Number(row.durationLe10),
						le50: Number(row.durationLe50),
						le100: Number(row.durationLe100),
						le500: Number(row.durationLe500),
						le1000: Number(row.durationLe1000),
						gt1000: Number(row.durationGt1000),
					},
				};
			}),
		};
	}

	prune();
	return {
		record(input) {
			insert.run({
				$ts: input.ts ?? now(),
				$source: input.source,
				$vehicleName: input.vehicleName,
				$toolName: input.toolName,
				$operationVersion: input.operationVersion ?? null,
				$outcome: input.outcome,
				$errorCode: normalizeErrorCode(input.errorCode),
				$durationMs: input.durationMs ?? null,
				$callerSessionId: pseudonymize(input.callerSessionId),
				$principalId: pseudonymize(input.principalId),
			});
			prune();
		},
		query(query) {
			return queryResult(query).rows;
		},
		queryResult,
		close() {
			db.close();
		},
	};
}
