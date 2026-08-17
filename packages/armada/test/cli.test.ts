import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type CliIo, isCliEntrypoint, runCli } from "../src/cli.js";
import { type NativeServiceController, type NativeServiceManager, systemdStrategy } from "../src/index.js";
import { manifestJson } from "./fixtures.js";

function output(): { io: CliIo; stdout: string[]; stderr: string[] } {
	const stdout: string[] = [];
	const stderr: string[] = [];
	return { io: { stdout: (text) => stdout.push(text), stderr: (text) => stderr.push(text) }, stdout, stderr };
}

const manager: NativeServiceManager = {
	kind: "systemd",
	capabilities: {
		maximumMemoryBytes: true,
		maximumCpuPercent: true,
		maximumTasks: true,
		restartAlways: true,
		restartOnFailure: true,
		restartAttemptLimit: true,
		restartAttemptWindow: true,
		preventPrivilegeEscalation: true,
		privateTemporaryDirectory: true,
		networkReadiness: true,
	},
	inspect: () => Promise.resolve({ ok: true, services: [], diagnostics: [] }),
};

describe("armada CLI entrypoint", () => {
	it("recognizes an installed bin symlink", async () => {
		const directory = await mkdtemp(join(tmpdir(), "armada-cli-entrypoint-"));
		const modulePath = join(directory, "dist", "cli.js");
		const binPath = join(directory, "bin", "armada");
		await mkdir(join(directory, "dist"));
		await mkdir(join(directory, "bin"));
		await Bun.write(modulePath, "");
		await symlink(modulePath, binPath);
		expect(isCliEntrypoint(modulePath, binPath)).toBe(true);
	});
});

describe("armada plan", () => {
	it("runs manifest to plan through the injected native strategy", async () => {
		const directory = await mkdtemp(join(tmpdir(), "armada-cli-"));
		const path = join(directory, "armada.json");
		await writeFile(path, manifestJson());
		const captured = output();
		const code = await runCli(["plan", "--manifest", path, "--json"], { manager, io: captured.io });
		expect(code).toBe(0);
		expect(JSON.parse(captured.stdout.join(""))).toMatchObject({
			ok: true,
			manager: "systemd",
			operations: [{ kind: "install", name: "papyrus" }],
		});
		expect(captured.stderr).toEqual([]);
	});

	it("reconciles through the injected native controller", async () => {
		const directory = await mkdtemp(join(tmpdir(), "armada-cli-"));
		const path = join(directory, "armada.json");
		await writeFile(path, manifestJson());
		const events: string[] = [];
		const controller: NativeServiceController = {
			...manager,
			capabilities: systemdStrategy.capabilities,
			replaceDescriptorAtomically: (descriptor) => {
				events.push(`replace:${descriptor.identity}`);
				return Promise.resolve({ ok: true, diagnostics: [] });
			},
			start: (identity) => {
				events.push(`start:${identity}`);
				return Promise.resolve({ ok: true, diagnostics: [] });
			},
			stop: () => Promise.resolve({ ok: true, diagnostics: [] }),
			remove: () => Promise.resolve({ ok: true, diagnostics: [] }),
		};
		const captured = output();
		const code = await runCli(["reconcile", "--manifest", path, "--json"], {
			manager: controller,
			controller,
			readiness: { waitUntilReady: () => Promise.resolve({ ok: true, diagnostics: [] }) },
			io: captured.io,
		});
		expect(code).toBe(0);
		expect(JSON.parse(captured.stdout.join(""))).toMatchObject({ ok: true, applied: [{ kind: "install", name: "papyrus" }] });
		expect(events).toEqual(["replace:armada-papyrus.service", "start:armada-papyrus.service"]);
	});

	it("reports status and doctor diagnostics as bounded JSON", async () => {
		const directory = await mkdtemp(join(tmpdir(), "armada-cli-"));
		const path = join(directory, "armada.json");
		await writeFile(path, manifestJson());
		const captured = output();
		const code = await runCli(["status", "--manifest", path, "--json"], {
			manager,
			inspectProcesses: () => Promise.resolve([]),
			readHandle: () => Promise.resolve(undefined),
			executableExists: () => true,
			io: captured.io,
		});
		expect(code).toBe(0);
		expect(JSON.parse(captured.stdout.join(""))).toMatchObject({
			ok: true,
			vehicles: [{ name: "papyrus", nativeStatus: "absent", ready: false }],
		});
	});

	it("plans duplicate cleanup without signaling before explicit approval", async () => {
		const directory = await mkdtemp(join(tmpdir(), "armada-cli-"));
		const path = join(directory, "armada.json");
		await writeFile(path, manifestJson());
		const captured = output();
		const code = await runCli(["cleanup", "papyrus", "--manifest", path, "--json"], {
			manager,
			inspectProcesses: () =>
				Promise.resolve([
					{ pid: 42, executable: "/opt/papyrus/cli.js", command: "/opt/papyrus/cli.js serve" },
					{ pid: 43, executable: "/opt/papyrus/cli.js", command: "/opt/papyrus/cli.js serve" },
				]),
			readHandle: () => Promise.resolve(undefined),
			io: captured.io,
		});
		expect(code).toBe(0);
		expect(JSON.parse(captured.stdout.join(""))).toMatchObject({
			ok: true,
			plan: { vehicle: "papyrus", consequences: [{ pid: 42 }, { pid: 43 }] },
		});
	});

	it("restarts one named Vehicle unconditionally, even with zero declared drift", async () => {
		const directory = await mkdtemp(join(tmpdir(), "armada-cli-"));
		const path = join(directory, "armada.json");
		await writeFile(path, manifestJson());
		const events: string[] = [];
		const controller: NativeServiceController = {
			...manager,
			capabilities: systemdStrategy.capabilities,
			// actual state is reported "absent" by default `manager.inspect` above,
			// so plan/reconcile would see an "install", not a "restart" -- restart
			// must go straight to stop+start regardless of what plan would propose.
			replaceDescriptorAtomically: () => Promise.resolve({ ok: true, diagnostics: [] }),
			start: (identity) => {
				events.push(`start:${identity}`);
				return Promise.resolve({ ok: true, diagnostics: [] });
			},
			stop: (identity) => {
				events.push(`stop:${identity}`);
				return Promise.resolve({ ok: true, diagnostics: [] });
			},
			remove: () => Promise.resolve({ ok: true, diagnostics: [] }),
		};
		const captured = output();
		const code = await runCli(["restart", "papyrus", "--manifest", path, "--json"], {
			manager: controller,
			controller,
			readiness: { waitUntilReady: () => Promise.resolve({ ok: true, diagnostics: [] }) },
			io: captured.io,
		});
		expect(code).toBe(0);
		expect(JSON.parse(captured.stdout.join(""))).toMatchObject({ ok: true, restarted: "papyrus" });
		expect(events).toEqual(["stop:armada-papyrus.service", "start:armada-papyrus.service"]);
	});

	it("upserts integration Vehicle files into the authoritative manifest", async () => {
		const directory = await mkdtemp(join(tmpdir(), "armada-cli-"));
		const manifestPath = join(directory, "armada.json");
		const vehiclePath = join(directory, "vehicle.json");
		await writeFile(vehiclePath, JSON.stringify(JSON.parse(manifestJson()).vehicles[0]));
		const captured = output();
		const code = await runCli(["upsert", "--vehicle-file", vehiclePath, "--manifest", manifestPath, "--json"], {
			manager,
			io: captured.io,
		});
		expect(code).toBe(0);
		expect(JSON.parse(captured.stdout.join(""))).toMatchObject({ ok: true });
		expect(JSON.parse(await readFile(manifestPath, "utf8")).vehicles).toHaveLength(1);
	});

	it("upserts a Vehicle declaration from bounded stdin", async () => {
		const directory = await mkdtemp(join(tmpdir(), "armada-cli-"));
		const manifestPath = join(directory, "armada.json");
		const captured = output();
		const vehicleJson = JSON.stringify(JSON.parse(manifestJson()).vehicles[0]);
		const code = await runCli(["upsert", "--vehicle-file", "-", "--manifest", manifestPath, "--json"], {
			manager,
			io: captured.io,
			readInput: () => Promise.resolve(vehicleJson),
		});
		expect(code).toBe(0);
		expect(JSON.parse(await readFile(manifestPath, "utf8")).vehicles).toHaveLength(1);
	});

	it("returns stable machine-readable diagnostics for invalid input", async () => {
		const directory = await mkdtemp(join(tmpdir(), "armada-cli-"));
		const path = join(directory, "armada.json");
		await writeFile(path, "{");
		const captured = output();
		const code = await runCli(["plan", "--manifest", path, "--json"], { manager, io: captured.io });
		expect(code).toBe(1);
		expect(JSON.parse(captured.stdout.join(""))).toMatchObject({ ok: false, diagnostics: [{ code: "MANIFEST_JSON_INVALID" }] });
	});
});

describe("armada metrics", () => {
	it("requires a vehicle name", async () => {
		const captured = output();
		const code = await runCli(["metrics"], { manager, io: captured.io });
		expect(code).toBe(2);
	});

	it("reports 'no metrics recorded' for a vehicle with no metrics DB yet, rather than an error", async () => {
		const captured = output();
		const code = await runCli(["metrics", "papyrus"], {
			manager,
			io: captured.io,
			resolveMetricsPath: () => "/tmp/definitely-does-not-exist-armada-metrics-test.sqlite",
		});
		expect(code).toBe(0);
		expect(captured.stdout.join("")).toContain("no metrics recorded");
	});

	it("resolves the vehicle's own metrics path and queries it with the parsed filters, injected for testability", async () => {
		const captured = output();
		let resolvedFor: string | undefined;
		let queriedPath: string | undefined;
		let queriedWith: unknown;
		const code = await runCli(
			["metrics", "papyrus", "--since", "1000", "--until", "2000", "--tool", "tasks.create", "--source", "server", "--group-by", "toolName,outcome", "--json"],
			{
				manager,
				io: captured.io,
				resolveMetricsPath: (name) => {
					resolvedFor = name;
					return "/fake/papyrus/metrics.sqlite";
				},
				queryMetrics: (path, query) => {
					queriedPath = path;
					queriedWith = query;
					return [{ key: { toolName: "tasks.create", outcome: "success" }, count: 3, successCount: 3, failureCount: 0, avgDurationMs: 12 }];
				},
			},
		);
		expect(code).toBe(0);
		expect(resolvedFor).toBe("papyrus");
		expect(queriedPath).toBe("/fake/papyrus/metrics.sqlite");
		expect(queriedWith).toEqual({
			since: 1000,
			until: 2000,
			toolName: "tasks.create",
			source: "server",
			groupBy: ["toolName", "outcome"],
		});
		expect(JSON.parse(captured.stdout.join(""))).toMatchObject({
			ok: true,
			vehicle: "papyrus",
			rows: [{ key: { toolName: "tasks.create", outcome: "success" }, count: 3 }],
		});
	});

	it("accepts an ISO-8601 date for --since/--until, not just epoch milliseconds", async () => {
		const captured = output();
		let queriedWith: unknown;
		const code = await runCli(["metrics", "papyrus", "--since", "2024-01-01T00:00:00.000Z"], {
			manager,
			io: captured.io,
			resolveMetricsPath: () => "/fake/papyrus/metrics.sqlite",
			queryMetrics: (_path, query) => {
				queriedWith = query;
				return [];
			},
		});
		expect(code).toBe(0);
		expect(queriedWith).toEqual({ since: Date.parse("2024-01-01T00:00:00.000Z") });
	});

	it("rejects an invalid --since value", async () => {
		const captured = output();
		const code = await runCli(["metrics", "papyrus", "--since", "not-a-date"], { manager, io: captured.io });
		expect(code).toBe(2);
	});

	it("rejects an invalid --group-by dimension", async () => {
		const captured = output();
		const code = await runCli(["metrics", "papyrus", "--group-by", "bogus"], { manager, io: captured.io });
		expect(code).toBe(2);
	});

	it("rejects an invalid --source value", async () => {
		const captured = output();
		const code = await runCli(["metrics", "papyrus", "--source", "bogus"], { manager, io: captured.io });
		expect(code).toBe(2);
	});

	it("renders a human-readable table by default (no --json), one line per grouped row", async () => {
		const captured = output();
		const code = await runCli(["metrics", "papyrus", "--group-by", "toolName"], {
			manager,
			io: captured.io,
			resolveMetricsPath: () => "/fake/papyrus/metrics.sqlite",
			queryMetrics: () => [
				{ key: { toolName: "tasks.create" }, count: 5, successCount: 4, failureCount: 1, avgDurationMs: 42.6 },
				{ key: { toolName: "tools_list" }, count: 2, successCount: 2, failureCount: 0, avgDurationMs: null },
			],
		});
		expect(code).toBe(0);
		const text = captured.stdout.join("");
		expect(text).toContain("toolName=tasks.create: 5 call(s) (4 success, 1 failure), avg 43ms");
		expect(text).toContain("toolName=tools_list: 2 call(s) (2 success, 0 failure)");
		expect(text).not.toContain("tools_list, avg");
	});

	it("end to end against a real SQLite file, no injected dependencies -- the real resolveVehicleMetricsPath/queryVehicleMetrics wiring", async () => {
		const { Database } = await import("bun:sqlite");
		const directory = await mkdtemp(join(tmpdir(), "armada-metrics-e2e-"));
		const home = directory;
		const dbPath = join(home, ".local", "share", "acme-vehicle", "metrics.sqlite");
		await mkdir(join(home, ".local", "share", "acme-vehicle"), { recursive: true });
		const db = new Database(dbPath, { create: true });
		db.exec(
			"CREATE TABLE vehicle_tool_invocations (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, source TEXT NOT NULL, vehicle_name TEXT NOT NULL, tool_name TEXT NOT NULL, operation_version INTEGER, outcome TEXT NOT NULL, error_code TEXT, duration_ms INTEGER, caller_session_id TEXT, caller_project_root TEXT, principal_id TEXT)",
		);
		db.prepare(
			"INSERT INTO vehicle_tool_invocations (ts, source, vehicle_name, tool_name, outcome) VALUES ($ts, $source, $vehicleName, $toolName, $outcome)",
		).run({ $ts: Date.now(), $source: "server", $vehicleName: "acme-vehicle", $toolName: "tasks.create", $outcome: "success" });
		db.close();

		const captured = output();
		const code = await runCli(["metrics", "acme-vehicle", "--json"], {
			manager,
			io: captured.io,
			platform: "linux",
			env: {},
			home,
		});
		expect(code).toBe(0);
		expect(JSON.parse(captured.stdout.join(""))).toMatchObject({ ok: true, vehicle: "acme-vehicle", rows: [{ count: 1, successCount: 1 }] });
	});
});
