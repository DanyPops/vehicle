/**
 * Structured daemon lifecycle event log + generic diagnose primitive, adoptable by any
 * Vehicle-backed daemon's own daemon.ts composition root (startDaemon()/runDaemonProcess()).
 *
 * Every daemon in this ecosystem (Papyrus, Tickets, Pipes, web-spider, Jittor) previously
 * hand-rolled its own ad-hoc, unstructured lifecycle logging with no instance identity, no
 * launch provenance, no shutdown-reason taxonomy, and no way to inspect recent restart
 * history without reading a daemon-owned state file directly. This module is that shared
 * building block: a bounded, durable-across-restarts JSON event log (so a caller can see what
 * a *previous* process instance did, not just the current one), plus diagnoseDaemon() to
 * assemble "who am I, and what happened recently" without exposing the log's own storage
 * shape to the caller.
 *
 * Never logs credentials or artifact/domain-payload bodies -- DaemonLifecycleEvent's own shape
 * has no field for either, matching every other diagnostic log in this ecosystem's discipline.
 *
 * Storage is a bounded read-modify-write JSON array via vehicle-core's createAtomicJsonWriter
 * (the same primitive Jobs/Watchers persistence already uses) -- not a true append-only log,
 * since the whole point is a bounded retention window, not unbounded history. A daemon's own
 * single-instance lock (paths.ts's acquireDaemonLock) means at most one live writer at a time
 * in the normal case; a fast restart handoff could in principle race two writes a few
 * milliseconds apart, which is an acceptable, narrow window for a diagnostic log, not a
 * correctness-critical one.
 */
import { type AtomicJsonFsAdapter, createAtomicJsonWriter } from "@danypops/vehicle-core";
import type { LaunchProvenance } from "./daemon.ts";

export type DaemonLifecycleEventType = "started" | "already_running" | "stopped" | "crashed";

export interface DaemonLifecycleEvent {
	/** Minted once per daemon process start (a fresh randomUUID, not the PID) -- PID reuse across restarts is a real hazard this sidesteps. */
	instanceId: string;
	pid: number;
	type: DaemonLifecycleEventType;
	/** ISO-8601 timestamp. */
	at: string;
	provenance: LaunchProvenance;
	/** Shutdown reason ("SIGTERM", "SIGINT", "idle_budget_exceeded", "explicit", ...) or an already_running detail (e.g. the holder's pid) -- never a payload body. */
	reason?: string;
	/** Ties this event to whatever request/operation triggered it (see rpc-correlation.ts), when applicable. */
	correlationId?: string;
}

/** Matches every other Vehicle extensibility point's own bound discipline (MAX_PENDING_APPROVALS, MAX_LISTENERS_PER_EVENT, ...). */
export const DAEMON_LIFECYCLE_MAX_EVENTS = 50;

export interface DaemonLifecycleLog {
	/** Appends one event (with a fresh timestamp) and persists it, trimming to the oldest-dropped-first bound. Returns the fully-populated event actually recorded. */
	record(event: Omit<DaemonLifecycleEvent, "at">): Promise<DaemonLifecycleEvent>;
	/** Most-recent-last. Bounded to `limit` (defaulting to every retained event) -- never unbounded. */
	recent(limit?: number): Promise<DaemonLifecycleEvent[]>;
}

export interface DaemonLifecycleLogOptions {
	path: string;
	fs: AtomicJsonFsAdapter;
	/** Defaults to `() => new Date().toISOString()`. Injectable for deterministic tests. */
	now?: () => string;
	/** Defaults to DAEMON_LIFECYCLE_MAX_EVENTS. */
	maxEvents?: number;
}

function isDaemonLifecycleEvent(value: unknown): value is DaemonLifecycleEvent {
	if (typeof value !== "object" || value === null) return false;
	const record = value as Record<string, unknown>;
	return (
		typeof record.instanceId === "string" &&
		typeof record.pid === "number" &&
		(record.type === "started" || record.type === "already_running" || record.type === "stopped" || record.type === "crashed") &&
		typeof record.at === "string" &&
		typeof record.provenance === "string"
	);
}

export function openDaemonLifecycleLog(options: DaemonLifecycleLogOptions): DaemonLifecycleLog {
	const writer = createAtomicJsonWriter({ fs: options.fs });
	const maxEvents = options.maxEvents ?? DAEMON_LIFECYCLE_MAX_EVENTS;
	const now = options.now ?? (() => new Date().toISOString());

	// A malformed/corrupted file (hand-edited, truncated by a crash mid-write before the
	// atomic rename ever fully lands) must never prevent a daemon from starting -- diagnostics
	// degrading to "no history" is always preferable to daemon startup failing.
	async function readAll(): Promise<DaemonLifecycleEvent[]> {
		let raw: unknown;
		try {
			raw = await writer.read(options.path);
		} catch {
			return [];
		}
		if (!Array.isArray(raw)) return [];
		return raw.filter(isDaemonLifecycleEvent);
	}

	return {
		async record(event) {
			const full: DaemonLifecycleEvent = { ...event, at: now() };
			const existing = await readAll();
			const updated = [...existing, full].slice(-maxEvents);
			await writer.write(options.path, updated, { mode: 0o600 });
			return full;
		},
		async recent(limit) {
			const all = await readAll();
			return limit === undefined ? all : all.slice(-limit);
		},
	};
}

export interface DaemonIdentity {
	instanceId: string;
	pid: number;
	/** ISO-8601 timestamp this instance actually came up. */
	startedAt: string;
	provenance: LaunchProvenance;
}

export interface DaemonDiagnosis extends DaemonIdentity {
	/** Most-recent-last, bounded by historyLimit (or the log's own retention bound). */
	history: DaemonLifecycleEvent[];
}

export interface DiagnoseDaemonOptions {
	lifecycleLog: DaemonLifecycleLog;
	current: DaemonIdentity;
	historyLimit?: number;
}

/**
 * Assembles "who am I, and what happened recently" -- the one function a Vehicle-backed
 * daemon's own composition root wires into a `daemon.diagnose` operation (a few lines, not a
 * bespoke per-daemon implementation), so a caller never reads daemon-owned SQLite/state files
 * directly to answer "is this daemon flapping".
 */
export async function diagnoseDaemon(options: DiagnoseDaemonOptions): Promise<DaemonDiagnosis> {
	const history = await options.lifecycleLog.recent(options.historyLimit);
	return { ...options.current, history };
}
