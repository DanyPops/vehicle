/**
 * Reads a Vehicle's own tool/operation usage metrics (@danypops/vehicle-server's own
 * vehicle-metrics-store.ts) directly from its SQLite file -- no daemon round-trip needed. Path
 * resolution and the query engine are both deliberately DUPLICATED from vehicle-server rather
 * than imported: vehicle-server depends on this package (@danypops/armada), so the reverse
 * import would be a real circular dependency, not just an inconvenience. There is no third,
 * lower-level package either currently depends on to share this code through instead. Keep the
 * per-OS path convention/default filename and the `vehicle_tool_invocations` table shape in sync
 * with vehicle-server's own paths.ts/vehicle-metrics-store.ts if either ever changes.
 *
 * Read-only throughout -- this CLI never writes metrics, only reports them.
 *
 * SQLite access mirrors vehicle-server's own storage.ts dual-runtime pattern (bun:sqlite under
 * Bun, node:sqlite everywhere else) via a lazy createRequire -- not a static `import ... from
 * "node:sqlite"`, which Bun's own module resolver rejects outright at parse time ("No such
 * built-in module: node:sqlite"), breaking every test in this package's own `bun test` suite the
 * moment this module is merely imported, let alone executed. A tiny locally-declared structural
 * interface (MinimalReadOnlyDatabase) is deliberately used instead of either module's own real
 * types, so this file needs neither "bun-types" nor a node:sqlite type version bump in this
 * package's own tsconfig (which targets plain "node" types only).
 */
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { posix, win32 } from "node:path";

const require = createRequire(import.meta.url);
// `typeof (globalThis as {...}).Bun` rather than a bare `typeof Bun` -- this file is part of the
// main built CLI (unlike vehicle-server's own storage.ts, which stays source-only exactly to
// avoid this), and armada's own tsconfig.build.json has no "bun-types" (a bare `Bun` reference
// there fails with "Cannot find name 'Bun'"). Indexing through globalThis needs no ambient type
// declaration at all.
const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== "undefined";

/** Satisfied structurally by both bun:sqlite's Database and node:sqlite's DatabaseSync -- see this module's own header comment for why neither's real type is imported. */
interface MinimalReadOnlyDatabase {
	prepare(sql: string): { all(params?: Record<string, unknown>): unknown[] };
	close(): void;
}

function openReadOnlyDatabase(path: string): MinimalReadOnlyDatabase {
	if (isBun) {
		const bunSqlite = require("bun:sqlite") as {
			Database: new (path: string, options?: { readonly?: boolean }) => MinimalReadOnlyDatabase;
		};
		return new bunSqlite.Database(path, { readonly: true });
	}
	const nodeSqlite = require("node:sqlite") as {
		DatabaseSync: new (path: string, options?: { readOnly?: boolean }) => MinimalReadOnlyDatabase;
	};
	return new nodeSqlite.DatabaseSync(path, { readOnly: true });
}

const DEFAULT_METRICS_FILENAME = "metrics.sqlite";

/** Same per-OS convention as vehicle-server's own resolveDaemonPaths -- see this module's own header comment for why it's duplicated, not imported. */
export function resolveVehicleMetricsPath(
	vehicleName: string,
	platform: NodeJS.Platform = process.platform,
	env: NodeJS.ProcessEnv = process.env,
	home: string = homedir(),
): string {
	// posix.join/win32.join (never the bare, host-dependent join) throughout -- this function must
	// produce the SAME real path for a given (platform, env, home) regardless of which host OS
	// actually runs it, or a Linux/macOS assertion silently becomes a Windows path (backslashes)
	// the moment this runs on Windows CI, and vice versa. Same reasoning as paths.ts's own win32
	// branch, applied symmetrically to darwin/linux here since armada's own test suite (unlike
	// vehicle-server's) genuinely runs cross-platform in CI (see .github/workflows/ci.yml).
	if (platform === "darwin") return posix.join(home, "Library", "Application Support", vehicleName, DEFAULT_METRICS_FILENAME);
	if (platform === "win32") {
		// biome-ignore lint/complexity/useLiteralKeys: required by noPropertyAccessFromIndexSignature
		const localAppData = env["LOCALAPPDATA"] ?? win32.join(home, "AppData", "Local");
		return win32.join(localAppData, vehicleName, "Data", DEFAULT_METRICS_FILENAME);
	}
	// biome-ignore lint/complexity/useLiteralKeys: required by noPropertyAccessFromIndexSignature
	const dataHome = env["XDG_DATA_HOME"] ?? posix.join(home, ".local", "share");
	return posix.join(dataHome, vehicleName, DEFAULT_METRICS_FILENAME);
}

export type VehicleMetricsGroupDimension = "toolName" | "vehicleName" | "source" | "callerSessionId" | "outcome" | "day" | "hour";

export interface VehicleMetricsQuery {
	/** Epoch ms, inclusive. Omit for "since the beginning". */
	readonly since?: number;
	/** Epoch ms, exclusive. Omit for "through now". */
	readonly until?: number;
	readonly source?: "server" | "client";
	readonly toolName?: string;
	readonly vehicleName?: string;
	readonly callerSessionId?: string;
	readonly groupBy?: readonly VehicleMetricsGroupDimension[];
}

export interface VehicleMetricsSummaryRow {
	readonly key: Readonly<Record<string, string>>;
	readonly count: number;
	readonly successCount: number;
	readonly failureCount: number;
	readonly avgDurationMs: number | null;
}

/** Same mapping as vehicle-metrics-store.ts's own GROUP_EXPRESSION. Column identifiers are drawn only from this fixed map (never caller-supplied text), so the SQL string interpolation below is safe. */
const GROUP_EXPRESSION: Readonly<Record<VehicleMetricsGroupDimension, string>> = {
	toolName: "tool_name",
	vehicleName: "vehicle_name",
	source: "source",
	callerSessionId: "caller_session_id",
	outcome: "outcome",
	day: "strftime('%Y-%m-%d', ts / 1000, 'unixepoch')",
	hour: "strftime('%Y-%m-%dT%H:00', ts / 1000, 'unixepoch')",
};

/**
 * Queries a Vehicle's own metrics.sqlite file directly, read-only. Returns an empty array
 * (rather than throwing) when the file doesn't exist yet -- a Vehicle that hasn't opted into
 * metrics, or simply hasn't recorded anything yet, is a normal state, not an error.
 */
export function queryVehicleMetrics(dbPath: string, query: VehicleMetricsQuery = {}): readonly VehicleMetricsSummaryRow[] {
	if (!existsSync(dbPath)) return [];
	const db = openReadOnlyDatabase(dbPath);
	try {
		const where: string[] = [];
		const params: Record<string, string | number> = {};
		if (query.since !== undefined) {
			where.push("ts >= $since");
			params["$since"] = query.since;
		}
		if (query.until !== undefined) {
			where.push("ts < $until");
			params["$until"] = query.until;
		}
		if (query.source !== undefined) {
			where.push("source = $source");
			params["$source"] = query.source;
		}
		if (query.toolName !== undefined) {
			where.push("tool_name = $toolName");
			params["$toolName"] = query.toolName;
		}
		if (query.vehicleName !== undefined) {
			where.push("vehicle_name = $vehicleName");
			params["$vehicleName"] = query.vehicleName;
		}
		if (query.callerSessionId !== undefined) {
			where.push("caller_session_id = $callerSessionId");
			params["$callerSessionId"] = query.callerSessionId;
		}
		const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

		const groupBy = query.groupBy ?? [];
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
		const rows = db.prepare(sql).all(params) as readonly Record<string, unknown>[];
		return rows.map((row) => {
			const key: Record<string, string> = {};
			for (const dimension of groupBy) key[dimension] = String(row[dimension] ?? "");
			return {
				key,
				count: Number(row["count"]),
				successCount: Number(row["successCount"]),
				failureCount: Number(row["failureCount"]),
				avgDurationMs: row["avgDurationMs"] === null || row["avgDurationMs"] === undefined ? null : Number(row["avgDurationMs"]),
			};
		});
	} finally {
		db.close();
	}
}
