import { describe, expect, it } from "bun:test";
import type { AtomicJsonFsAdapter } from "@danypops/vehicle-core";
import { DAEMON_LIFECYCLE_MAX_EVENTS, diagnoseDaemon, openDaemonLifecycleLog } from "../src/daemon-lifecycle.ts";

function createFakeFs(): AtomicJsonFsAdapter & { readonly files: Map<string, string> } {
	const files = new Map<string, string>();
	return {
		files,
		async writeFile(path, data) {
			files.set(path, data);
		},
		async rename(oldPath, newPath) {
			const data = files.get(oldPath);
			if (data === undefined) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
			files.set(newPath, data);
			files.delete(oldPath);
		},
		async unlink(path) {
			files.delete(path);
		},
		async readFile(path) {
			const data = files.get(path);
			if (data === undefined) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
			return data;
		},
	};
}

describe("daemon-lifecycle: structured lifecycle event log", () => {
	it("starts empty when no file exists yet", async () => {
		const log = openDaemonLifecycleLog({ path: "/state/lifecycle.json", fs: createFakeFs() });
		expect(await log.recent()).toEqual([]);
	});

	it("records a started event with instance id, pid, provenance, and a timestamp", async () => {
		const log = openDaemonLifecycleLog({ path: "/state/lifecycle.json", fs: createFakeFs(), now: () => "2026-01-01T00:00:00.000Z" });
		const recorded = await log.record({ instanceId: "instance-1", pid: 4242, type: "started", provenance: "service" });
		expect(recorded).toEqual({
			instanceId: "instance-1",
			pid: 4242,
			type: "started",
			provenance: "service",
			at: "2026-01-01T00:00:00.000Z",
		});
		expect(await log.recent()).toEqual([recorded]);
	});

	it("carries an optional reason and correlationId through unchanged", async () => {
		const log = openDaemonLifecycleLog({ path: "/state/lifecycle.json", fs: createFakeFs(), now: () => "2026-01-01T00:00:01.000Z" });
		const recorded = await log.record({
			instanceId: "instance-1",
			pid: 4242,
			type: "already_running",
			provenance: "auto-spawn",
			reason: "holder pid 999",
			correlationId: "corr-abc",
		});
		expect(recorded.reason).toBe("holder pid 999");
		expect(recorded.correlationId).toBe("corr-abc");
	});

	it("persists across a fresh openDaemonLifecycleLog against the same file -- a restarted process must see its predecessor's history", async () => {
		const fs = createFakeFs();
		const first = openDaemonLifecycleLog({ path: "/state/lifecycle.json", fs });
		await first.record({ instanceId: "instance-1", pid: 1, type: "started", provenance: "service" });
		await first.record({ instanceId: "instance-1", pid: 1, type: "stopped", provenance: "service", reason: "SIGTERM" });

		const second = openDaemonLifecycleLog({ path: "/state/lifecycle.json", fs });
		const history = await second.recent();
		expect(history).toHaveLength(2);
		expect(history[0]?.type).toBe("started");
		expect(history[1]?.type).toBe("stopped");
	});

	it("is bounded -- retains only the most recent DAEMON_LIFECYCLE_MAX_EVENTS entries, oldest dropped first", async () => {
		const fs = createFakeFs();
		const log = openDaemonLifecycleLog({ path: "/state/lifecycle.json", fs, maxEvents: 3 });
		for (let i = 0; i < 5; i++) {
			await log.record({ instanceId: `instance-${i}`, pid: i, type: "started", provenance: "unknown" });
		}
		const history = await log.recent();
		expect(history).toHaveLength(3);
		expect(history.map((event) => event.instanceId)).toEqual(["instance-2", "instance-3", "instance-4"]);
	});

	it("defaults maxEvents to DAEMON_LIFECYCLE_MAX_EVENTS when not overridden", async () => {
		const fs = createFakeFs();
		const log = openDaemonLifecycleLog({ path: "/state/lifecycle.json", fs });
		for (let i = 0; i < DAEMON_LIFECYCLE_MAX_EVENTS + 10; i++) {
			await log.record({ instanceId: `instance-${i}`, pid: i, type: "started", provenance: "unknown" });
		}
		expect(await log.recent()).toHaveLength(DAEMON_LIFECYCLE_MAX_EVENTS);
	});

	it("recent(limit) returns only the last `limit` entries, most-recent-last", async () => {
		const fs = createFakeFs();
		const log = openDaemonLifecycleLog({ path: "/state/lifecycle.json", fs });
		for (let i = 0; i < 5; i++) {
			await log.record({ instanceId: `instance-${i}`, pid: i, type: "started", provenance: "unknown" });
		}
		const last2 = await log.recent(2);
		expect(last2.map((event) => event.instanceId)).toEqual(["instance-3", "instance-4"]);
	});

	it("ignores a corrupted or non-array file instead of throwing -- a lifecycle log must never crash daemon startup", async () => {
		const fs = createFakeFs();
		fs.files.set("/state/lifecycle.json", "not json at all {{{");
		const log = openDaemonLifecycleLog({ path: "/state/lifecycle.json", fs });
		expect(await log.recent()).toEqual([]);
		const recorded = await log.record({ instanceId: "instance-1", pid: 1, type: "started", provenance: "service" });
		expect(await log.recent()).toEqual([recorded]);
	});

	it("filters out a malformed entry (e.g. hand-edited file) rather than surfacing garbage", async () => {
		const fs = createFakeFs();
		fs.files.set(
			"/state/lifecycle.json",
			JSON.stringify([{ instanceId: "ok", pid: 1, type: "started", provenance: "service", at: "x" }, { garbage: true }, "not an object"]),
		);
		const log = openDaemonLifecycleLog({ path: "/state/lifecycle.json", fs });
		const history = await log.recent();
		expect(history).toHaveLength(1);
		expect(history[0]?.instanceId).toBe("ok");
	});

	it("never logs credentials or arbitrary payload bodies -- the event shape has no field for them", async () => {
		const log = openDaemonLifecycleLog({ path: "/state/lifecycle.json", fs: createFakeFs() });
		const recorded = await log.record({ instanceId: "instance-1", pid: 1, type: "started", provenance: "service" });
		expect(Object.keys(recorded).sort()).toEqual(["at", "instanceId", "pid", "provenance", "type"]);
	});
});

describe("daemon-lifecycle: diagnoseDaemon", () => {
	it("reports current identity plus recent history, without the caller reading any state file directly", async () => {
		const fs = createFakeFs();
		const log = openDaemonLifecycleLog({ path: "/state/lifecycle.json", fs });
		await log.record({ instanceId: "instance-old", pid: 1, type: "started", provenance: "service" });
		await log.record({ instanceId: "instance-old", pid: 1, type: "stopped", provenance: "service", reason: "SIGTERM" });

		const diagnosis = await diagnoseDaemon({
			lifecycleLog: log,
			current: { instanceId: "instance-new", pid: 2, startedAt: "2026-01-01T00:00:02.000Z", provenance: "service" },
		});
		expect(diagnosis.instanceId).toBe("instance-new");
		expect(diagnosis.pid).toBe(2);
		expect(diagnosis.startedAt).toBe("2026-01-01T00:00:02.000Z");
		expect(diagnosis.provenance).toBe("service");
		expect(diagnosis.history).toHaveLength(2);
	});

	it("bounds history to historyLimit when given", async () => {
		const fs = createFakeFs();
		const log = openDaemonLifecycleLog({ path: "/state/lifecycle.json", fs });
		for (let i = 0; i < 10; i++) await log.record({ instanceId: `i${i}`, pid: i, type: "started", provenance: "unknown" });

		const diagnosis = await diagnoseDaemon({
			lifecycleLog: log,
			current: { instanceId: "current", pid: 99, startedAt: "now", provenance: "unknown" },
			historyLimit: 3,
		});
		expect(diagnosis.history).toHaveLength(3);
	});
});
