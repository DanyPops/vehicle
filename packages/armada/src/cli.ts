#!/usr/bin/env node
import { existsSync, realpathSync } from "node:fs";
import { lstat, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, win32 } from "node:path";
import { fileURLToPath } from "node:url";
import { type BenchmarkResult, benchmarkSystemdService, type SystemdBenchmarkRequest } from "./fleet/benchmark.js";
import { executeCleanup, planDuplicateCleanup } from "./fleet/cleanup.js";
import { type Diagnostic, diagnostic } from "./fleet/diagnostic.js";
import { inspectHostProcesses, readVehicleHandles } from "./fleet/host-inspection.js";
import { decodeArmadaManifest, MAX_MANIFEST_BYTES, type ManifestDecodeOutcome } from "./fleet/manifest.js";
import { removeManifestVehicle, upsertManifestVehicle } from "./fleet/manifest-store.js";
import {
	type queryVehicleMetrics,
	queryVehicleMetricsResult,
	resolveVehicleMetricsPath,
	type VehicleMetricsGroupDimension,
	type VehicleMetricsSummaryRow,
} from "./fleet/metrics.js";
import { planFleet } from "./fleet/planner.js";
import { createHandleReadinessProbe, readVehicleHandleFile } from "./fleet/readiness.js";
import { reconcileFleet, restartVehicle } from "./fleet/reconciler.js";
import { buildFleetStatus, type ObservedProcess } from "./fleet/status.js";
import { createNativeController, defaultDescriptorRoot, processCommandRunner, strategyForNativeManager } from "./native/controller.js";
import type { NativeManagerKind, NativeServiceController, NativeServiceManager, ReadinessProbe } from "./native/service-manager.js";

export interface CliIo {
	stdout(text: string): void;
	stderr(text: string): void;
}

export interface CliDependencies {
	readonly manager: NativeServiceManager;
	readonly controller?: NativeServiceController;
	readonly readiness?: ReadinessProbe;
	readonly inspectProcesses?: () => Promise<readonly ObservedProcess[]>;
	readonly readHandle?: (path: string) => Promise<unknown>;
	readonly executableExists?: (path: string) => boolean;
	readonly readInput?: () => Promise<string>;
	readonly io: CliIo;
	readonly platform?: NodeJS.Platform;
	readonly env?: NodeJS.ProcessEnv;
	readonly home?: string;
	/** Overridable for tests -- defaults to resolveVehicleMetricsPath (fleet/metrics.ts). */
	readonly resolveMetricsPath?: (vehicleName: string) => string;
	/** Overridable for tests -- defaults to queryVehicleMetrics (fleet/metrics.ts), reading the real SQLite file. */
	readonly queryMetrics?: (dbPath: string, query: Parameters<typeof queryVehicleMetrics>[1]) => readonly VehicleMetricsSummaryRow[];
	/** Overridable for tests -- defaults to the Linux/systemd cgroup benchmark implementation. */
	readonly runBenchmark?: (request: SystemdBenchmarkRequest) => Promise<BenchmarkResult>;
}

const METRICS_GROUP_DIMENSIONS: readonly VehicleMetricsGroupDimension[] = [
	"toolName",
	"vehicleName",
	"source",
	"callerSessionId",
	"outcome",
	"errorCode",
	"day",
	"hour",
];

interface PlanArguments {
	readonly manifestPath: string;
	readonly json: boolean;
	readonly vehicle?: string;
	readonly approval?: string;
	readonly vehicleFile?: string;
	readonly since?: number;
	readonly until?: number;
	readonly tool?: string;
	readonly source?: "server" | "client";
	readonly groupBy?: readonly VehicleMetricsGroupDimension[];
	readonly limit?: number;
	readonly workloadCommand?: string;
	readonly workloadArguments?: readonly string[];
	readonly warmup?: number;
	readonly repetitions?: number;
	readonly concurrency?: number;
	readonly deadlineMs?: number;
	readonly sampleIntervalMs?: number;
	readonly maxOutputBytes?: number;
}

type ArgumentOutcome = { readonly ok: true; readonly arguments: PlanArguments } | { readonly ok: false; readonly diagnostic: Diagnostic };

const BENCHMARK_LIMITS = Object.freeze({
	warmup: { default: 1, min: 0, max: 20 },
	repetitions: { default: 5, min: 1, max: 100 },
	concurrency: { default: 1, min: 1, max: 16 },
	deadlineMs: { default: 60_000, min: 100, max: 300_000 },
	sampleIntervalMs: { default: 50, min: 10, max: 1_000 },
	maxOutputBytes: { default: 65_536, min: 1, max: 1_048_576 },
});
const MAX_BENCHMARK_ARGUMENTS = 64;
const MAX_BENCHMARK_ARGUMENT_BYTES = 4_096;

function parseBoundedInteger(value: string | undefined, name: string, min: number, max: number): number | Diagnostic {
	const parsed = Number(value);
	if (!value || !Number.isInteger(parsed) || parsed < min || parsed > max)
		return diagnostic("CLI_ARGUMENT_INVALID", "error", name, `expected an integer from ${min} through ${max}`);
	return parsed;
}

function cliHelp(): string {
	return [
		"usage: armada <plan|reconcile|status|doctor|cleanup|upsert|remove|restart|metrics|benchmark> [options]",
		"",
		"metrics <vehicle> [--since <time>] [--until <time>] [--tool <name>] [--source <server|client>] [--group-by <dimensions>] [--limit <1-1000>] [--json]",
		"benchmark <vehicle> --exec <path> [--arg <value> ...] [--manifest <path>] [--json]",
		`  --warmup <${BENCHMARK_LIMITS.warmup.min}-${BENCHMARK_LIMITS.warmup.max}>`,
		`  --repetitions <${BENCHMARK_LIMITS.repetitions.min}-${BENCHMARK_LIMITS.repetitions.max}>`,
		`  --concurrency <${BENCHMARK_LIMITS.concurrency.min}-${BENCHMARK_LIMITS.concurrency.max}>`,
		`  --deadline-ms <${BENCHMARK_LIMITS.deadlineMs.min}-${BENCHMARK_LIMITS.deadlineMs.max}>`,
		`  --sample-ms <${BENCHMARK_LIMITS.sampleIntervalMs.min}-${BENCHMARK_LIMITS.sampleIntervalMs.max}>`,
		`  --max-output-bytes <${BENCHMARK_LIMITS.maxOutputBytes.min}-${BENCHMARK_LIMITS.maxOutputBytes.max}>`,
		"",
		"Benchmark output records bounded counters and digests; workload paths, arguments, URLs, and response content are omitted.",
	].join("\n");
}

export function defaultManifestPath(
	platform: NodeJS.Platform = process.platform,
	env: NodeJS.ProcessEnv = process.env,
	home: string = homedir(),
): string {
	if (platform === "darwin") return join(home, "Library", "Application Support", "armada", "armada.json");
	// TS's own noPropertyAccessFromIndexSignature (tsconfig.json) requires bracket notation here --
	// biome's useLiteralKeys disagrees, since NodeJS.ProcessEnv's known keys aren't literal properties.
	// biome-ignore lint/complexity/useLiteralKeys: required by noPropertyAccessFromIndexSignature
	if (platform === "win32") return win32.join(env["APPDATA"] ?? win32.join(home, "AppData", "Roaming"), "Armada", "armada.json");
	// biome-ignore lint/complexity/useLiteralKeys: required by noPropertyAccessFromIndexSignature
	return join(env["XDG_CONFIG_HOME"] ?? join(home, ".config"), "armada", "armada.json");
}

function parsePlanArguments(args: readonly string[], dependencies: CliDependencies, command: string): ArgumentOutcome {
	let manifestPath = defaultManifestPath(dependencies.platform, dependencies.env, dependencies.home);
	let json = false;
	let vehicle: string | undefined;
	let approval: string | undefined;
	let vehicleFile: string | undefined;
	let since: number | undefined;
	let until: number | undefined;
	let tool: string | undefined;
	let source: "server" | "client" | undefined;
	let groupBy: readonly VehicleMetricsGroupDimension[] | undefined;
	let metricsLimit: number | undefined;
	let workloadCommand: string | undefined;
	const workloadArguments: string[] = [];
	let warmup: number | undefined;
	let repetitions: number | undefined;
	let concurrency: number | undefined;
	let deadlineMs: number | undefined;
	let sampleIntervalMs: number | undefined;
	let maxOutputBytes: number | undefined;
	for (let index = 0; index < args.length; index++) {
		const argument = args[index];
		if (argument === "--json") {
			json = true;
			continue;
		}
		if (argument === "--vehicle-file") {
			const value = args[index + 1];
			if (!value) return { ok: false, diagnostic: diagnostic("CLI_ARGUMENT_MISSING", "error", "--vehicle-file", "path is required") };
			vehicleFile = value;
			index++;
			continue;
		}
		if (argument === "--approve") {
			const value = args[index + 1];
			if (!value) return { ok: false, diagnostic: diagnostic("CLI_ARGUMENT_MISSING", "error", "--approve", "plan hash is required") };
			approval = value;
			index++;
			continue;
		}
		if (argument === "--manifest") {
			const value = args[index + 1];
			if (!value) return { ok: false, diagnostic: diagnostic("CLI_ARGUMENT_MISSING", "error", "--manifest", "path is required") };
			manifestPath = value;
			index++;
			continue;
		}
		if (command === "metrics" && (argument === "--since" || argument === "--until")) {
			const value = args[index + 1];
			const parsed = value === undefined ? Number.NaN : Number.isNaN(Number(value)) ? Date.parse(value) : Number(value);
			if (!value || Number.isNaN(parsed)) {
				return {
					ok: false,
					diagnostic: diagnostic("CLI_ARGUMENT_INVALID", "error", argument, "expected an epoch-ms number or an ISO-8601 date"),
				};
			}
			if (argument === "--since") since = parsed;
			else until = parsed;
			index++;
			continue;
		}
		if (command === "metrics" && argument === "--tool") {
			const value = args[index + 1];
			if (!value)
				return { ok: false, diagnostic: diagnostic("CLI_ARGUMENT_MISSING", "error", "--tool", "a tool/operation name is required") };
			tool = value;
			index++;
			continue;
		}
		if (command === "metrics" && argument === "--source") {
			const value = args[index + 1];
			if (value !== "server" && value !== "client") {
				return { ok: false, diagnostic: diagnostic("CLI_ARGUMENT_INVALID", "error", "--source", 'expected "server" or "client"') };
			}
			source = value;
			index++;
			continue;
		}
		if (command === "metrics" && argument === "--limit") {
			const parsedValue = parseBoundedInteger(args[index + 1], "--limit", 1, 1_000);
			if (typeof parsedValue !== "number") return { ok: false, diagnostic: parsedValue };
			metricsLimit = parsedValue;
			index++;
			continue;
		}
		if (command === "metrics" && argument === "--group-by") {
			const value = args[index + 1];
			const requested = (value ?? "").split(",").filter((entry) => entry.length > 0);
			const invalid = requested.find((entry) => !(METRICS_GROUP_DIMENSIONS as readonly string[]).includes(entry));
			if (!value || requested.length === 0 || invalid !== undefined) {
				return {
					ok: false,
					diagnostic: diagnostic(
						"CLI_ARGUMENT_INVALID",
						"error",
						"--group-by",
						`expected a comma-separated list of: ${METRICS_GROUP_DIMENSIONS.join(", ")}`,
					),
				};
			}
			groupBy = requested as VehicleMetricsGroupDimension[];
			index++;
			continue;
		}
		if (command === "benchmark" && argument === "--exec") {
			const value = args[index + 1];
			if (!value) return { ok: false, diagnostic: diagnostic("CLI_ARGUMENT_MISSING", "error", "--exec", "an executable path is required") };
			if (Buffer.byteLength(value) > MAX_BENCHMARK_ARGUMENT_BYTES)
				return { ok: false, diagnostic: diagnostic("CLI_ARGUMENT_INVALID", "error", "--exec", "executable path is too long") };
			workloadCommand = value;
			index++;
			continue;
		}
		if (command === "benchmark" && argument === "--arg") {
			const value = args[index + 1];
			if (value === undefined)
				return { ok: false, diagnostic: diagnostic("CLI_ARGUMENT_MISSING", "error", "--arg", "a value is required") };
			if (workloadArguments.length >= MAX_BENCHMARK_ARGUMENTS || Buffer.byteLength(value) > MAX_BENCHMARK_ARGUMENT_BYTES)
				return {
					ok: false,
					diagnostic: diagnostic("CLI_ARGUMENT_INVALID", "error", "--arg", "workload arguments exceed the configured bounds"),
				};
			workloadArguments.push(value);
			index++;
			continue;
		}
		if (
			command === "benchmark" &&
			["--warmup", "--repetitions", "--concurrency", "--deadline-ms", "--sample-ms", "--max-output-bytes"].includes(argument ?? "")
		) {
			const key =
				argument === "--warmup"
					? "warmup"
					: argument === "--repetitions"
						? "repetitions"
						: argument === "--concurrency"
							? "concurrency"
							: argument === "--deadline-ms"
								? "deadlineMs"
								: argument === "--sample-ms"
									? "sampleIntervalMs"
									: "maxOutputBytes";
			const limit = BENCHMARK_LIMITS[key];
			const parsedValue = parseBoundedInteger(args[index + 1], argument ?? "", limit.min, limit.max);
			if (typeof parsedValue !== "number") return { ok: false, diagnostic: parsedValue };
			if (key === "warmup") warmup = parsedValue;
			else if (key === "repetitions") repetitions = parsedValue;
			else if (key === "concurrency") concurrency = parsedValue;
			else if (key === "deadlineMs") deadlineMs = parsedValue;
			else if (key === "sampleIntervalMs") sampleIntervalMs = parsedValue;
			else maxOutputBytes = parsedValue;
			index++;
			continue;
		}
		if (
			(command === "cleanup" || command === "remove" || command === "restart" || command === "metrics" || command === "benchmark") &&
			vehicle === undefined &&
			argument !== undefined &&
			!argument.startsWith("--")
		) {
			vehicle = argument;
			continue;
		}
		return { ok: false, diagnostic: diagnostic("CLI_ARGUMENT_UNKNOWN", "error", argument ?? "", "unknown argument") };
	}
	return {
		ok: true,
		arguments: {
			manifestPath,
			json,
			...(vehicle === undefined ? {} : { vehicle }),
			...(approval === undefined ? {} : { approval }),
			...(vehicleFile === undefined ? {} : { vehicleFile }),
			...(since === undefined ? {} : { since }),
			...(until === undefined ? {} : { until }),
			...(tool === undefined ? {} : { tool }),
			...(source === undefined ? {} : { source }),
			...(groupBy === undefined ? {} : { groupBy }),
			...(metricsLimit === undefined ? {} : { limit: metricsLimit }),
			...(workloadCommand === undefined ? {} : { workloadCommand }),
			...(workloadArguments.length === 0 ? {} : { workloadArguments }),
			...(warmup === undefined ? {} : { warmup }),
			...(repetitions === undefined ? {} : { repetitions }),
			...(concurrency === undefined ? {} : { concurrency }),
			...(deadlineMs === undefined ? {} : { deadlineMs }),
			...(sampleIntervalMs === undefined ? {} : { sampleIntervalMs }),
			...(maxOutputBytes === undefined ? {} : { maxOutputBytes }),
		},
	};
}

async function readManifest(path: string): Promise<ManifestDecodeOutcome> {
	try {
		const stat = await lstat(path);
		if (!stat.isFile() || stat.isSymbolicLink()) {
			return { ok: false, diagnostics: [diagnostic("MANIFEST_PATH_UNSAFE", "error", path, "manifest must be a regular file")] };
		}
		if (stat.size > MAX_MANIFEST_BYTES) {
			return { ok: false, diagnostics: [diagnostic("MANIFEST_TOO_LARGE", "error", path, "manifest exceeds 1 MiB")] };
		}
		return decodeArmadaManifest(await readFile(path, "utf8"));
	} catch (error) {
		return {
			ok: false,
			diagnostics: [diagnostic("MANIFEST_READ_FAILED", "error", path, error instanceof Error ? error.message : String(error))],
		};
	}
}

function writeDiagnostics(diagnostics: readonly Diagnostic[], json: boolean, io: CliIo): void {
	if (json) {
		io.stdout(`${JSON.stringify({ ok: false, diagnostics })}\n`);
		return;
	}
	for (const item of diagnostics) io.stderr(`${item.severity.toUpperCase()} ${item.code} ${item.path}: ${item.message}\n`);
}

export async function runCli(args: readonly string[], dependencies: CliDependencies): Promise<number> {
	const [command, ...rest] = args;
	if (command === "help" || command === "--help" || (command === "benchmark" && rest[0] === "--help")) {
		dependencies.io.stdout(`${cliHelp()}\n`);
		return 0;
	}
	if (
		command !== "plan" &&
		command !== "reconcile" &&
		command !== "status" &&
		command !== "doctor" &&
		command !== "cleanup" &&
		command !== "upsert" &&
		command !== "remove" &&
		command !== "restart" &&
		command !== "metrics" &&
		command !== "benchmark"
	) {
		writeDiagnostics(
			[diagnostic("CLI_COMMAND_UNKNOWN", "error", command ?? "", cliHelp().split("\n", 1)[0] ?? "unknown command")],
			false,
			dependencies.io,
		);
		return 2;
	}
	const parsed = parsePlanArguments(rest, dependencies, command);
	if (!parsed.ok) {
		writeDiagnostics([parsed.diagnostic], false, dependencies.io);
		return 2;
	}
	if (command === "upsert") {
		if (!parsed.arguments.vehicleFile) {
			writeDiagnostics(
				[diagnostic("CLI_ARGUMENT_MISSING", "error", "--vehicle-file", "path is required")],
				parsed.arguments.json,
				dependencies.io,
			);
			return 2;
		}
		let vehicleJson: string;
		try {
			if (parsed.arguments.vehicleFile === "-") {
				if (!dependencies.readInput) throw new Error("standard input is unavailable");
				vehicleJson = await dependencies.readInput();
				if (Buffer.byteLength(vehicleJson) > MAX_MANIFEST_BYTES) throw new Error("Vehicle input exceeds 1 MiB");
			} else {
				const stat = await lstat(parsed.arguments.vehicleFile);
				if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_MANIFEST_BYTES)
					throw new Error("Vehicle file must be a bounded regular file");
				vehicleJson = await readFile(parsed.arguments.vehicleFile, "utf8");
			}
		} catch (error) {
			writeDiagnostics(
				[
					diagnostic(
						"VEHICLE_FILE_READ_FAILED",
						"error",
						parsed.arguments.vehicleFile,
						error instanceof Error ? error.message : String(error),
					),
				],
				parsed.arguments.json,
				dependencies.io,
			);
			return 1;
		}
		const updated = await upsertManifestVehicle(parsed.arguments.manifestPath, vehicleJson);
		if (!updated.ok) {
			writeDiagnostics(updated.diagnostics, parsed.arguments.json, dependencies.io);
			return 1;
		}
		dependencies.io.stdout(`${JSON.stringify({ ok: true, manifestHash: updated.manifest.contentHash })}\n`);
		return 0;
	}
	if (command === "metrics") {
		if (!parsed.arguments.vehicle) {
			writeDiagnostics(
				[diagnostic("METRICS_VEHICLE_UNKNOWN", "error", "/vehicle", "metrics requires a Vehicle name")],
				parsed.arguments.json,
				dependencies.io,
			);
			return 2;
		}
		const resolvePath =
			dependencies.resolveMetricsPath ??
			((name: string) => resolveVehicleMetricsPath(name, dependencies.platform, dependencies.env, dependencies.home));
		const dbPath = resolvePath(parsed.arguments.vehicle);
		const metricsQuery = {
			...(parsed.arguments.since === undefined ? {} : { since: parsed.arguments.since }),
			...(parsed.arguments.until === undefined ? {} : { until: parsed.arguments.until }),
			...(parsed.arguments.tool === undefined ? {} : { toolName: parsed.arguments.tool }),
			...(parsed.arguments.source === undefined ? {} : { source: parsed.arguments.source }),
			...(parsed.arguments.groupBy === undefined ? {} : { groupBy: parsed.arguments.groupBy }),
			...(parsed.arguments.limit === undefined ? {} : { limit: parsed.arguments.limit }),
		};
		const result = dependencies.queryMetrics
			? { rows: dependencies.queryMetrics(dbPath, metricsQuery), limit: parsed.arguments.limit ?? 100, truncated: false }
			: queryVehicleMetricsResult(dbPath, metricsQuery);
		const rows = result.rows;
		if (parsed.arguments.json) {
			dependencies.io.stdout(`${JSON.stringify({ ok: true, vehicle: parsed.arguments.vehicle, ...result })}\n`);
			return 0;
		}
		if (rows.length === 0) {
			dependencies.io.stdout(`${parsed.arguments.vehicle}: no metrics recorded (yet).\n`);
			return 0;
		}
		for (const row of rows) {
			const keyText = Object.entries(row.key)
				.map(([dimension, value]) => `${dimension}=${value}`)
				.join(" ");
			const avgText = row.avgDurationMs === null ? "" : `, avg ${Math.round(row.avgDurationMs)}ms`;
			const histogramText = row.durationHistogram
				? `, latency <=10/50/100/500/1000/>1000ms ${row.durationHistogram.le10}/${row.durationHistogram.le50}/${row.durationHistogram.le100}/${row.durationHistogram.le500}/${row.durationHistogram.le1000}/${row.durationHistogram.gt1000}`
				: "";
			const prefix = keyText.length > 0 ? `${keyText}: ` : "";
			dependencies.io.stdout(`${prefix}${row.count} call(s) (${row.successCount} success, ${row.failureCount} failure)${avgText}${histogramText}\n`);
		}
		if (result.truncated) dependencies.io.stdout(`Showing ${rows.length} groups; increase --limit to inspect more (maximum 1000).\n`);
		return 0;
	}
	const decoded = await readManifest(parsed.arguments.manifestPath);
	if (!decoded.ok) {
		writeDiagnostics(decoded.diagnostics, parsed.arguments.json, dependencies.io);
		return 1;
	}
	if (command === "benchmark") {
		const vehicle = decoded.manifest.vehicles.find((item) => item.name === parsed.arguments.vehicle);
		if (!vehicle || !parsed.arguments.workloadCommand) {
			writeDiagnostics(
				[diagnostic("BENCHMARK_INPUT_INVALID", "error", "/benchmark", "benchmark requires a declared Vehicle name and --exec workload")],
				parsed.arguments.json,
				dependencies.io,
			);
			return 2;
		}
		if (dependencies.manager.kind !== "systemd") {
			writeDiagnostics(
				[diagnostic("BENCHMARK_UNSUPPORTED", "error", "/benchmark", "cgroup benchmarking requires a systemd user service")],
				parsed.arguments.json,
				dependencies.io,
			);
			return 1;
		}
		const generated = strategyForNativeManager("systemd").generateDescriptor(vehicle);
		if (!generated.ok) {
			writeDiagnostics(generated.diagnostics, parsed.arguments.json, dependencies.io);
			return 1;
		}
		const request: SystemdBenchmarkRequest = {
			vehicle: vehicle.name,
			unit: generated.descriptor.identity,
			command: parsed.arguments.workloadCommand,
			arguments: parsed.arguments.workloadArguments ?? [],
			warmup: parsed.arguments.warmup ?? BENCHMARK_LIMITS.warmup.default,
			repetitions: parsed.arguments.repetitions ?? BENCHMARK_LIMITS.repetitions.default,
			concurrency: parsed.arguments.concurrency ?? BENCHMARK_LIMITS.concurrency.default,
			deadlineMs: parsed.arguments.deadlineMs ?? BENCHMARK_LIMITS.deadlineMs.default,
			sampleIntervalMs: parsed.arguments.sampleIntervalMs ?? BENCHMARK_LIMITS.sampleIntervalMs.default,
			maxOutputBytes: parsed.arguments.maxOutputBytes ?? BENCHMARK_LIMITS.maxOutputBytes.default,
		};
		let benchmark: BenchmarkResult;
		try {
			benchmark = await (dependencies.runBenchmark ?? ((input) => benchmarkSystemdService(input, processCommandRunner)))(request);
		} catch {
			writeDiagnostics(
				[diagnostic("BENCHMARK_FAILED", "error", "/benchmark", "benchmark could not complete; verify the service and workload")],
				parsed.arguments.json,
				dependencies.io,
			);
			return 1;
		}
		if (parsed.arguments.json) {
			dependencies.io.stdout(`${JSON.stringify({ ok: benchmark.workload.failureCount === 0, benchmark })}\n`);
			return benchmark.workload.failureCount === 0 ? 0 : 1;
		}
		const memoryMiB =
			benchmark.workload.observedPeakMemoryBytes === null
				? "unavailable"
				: `${(benchmark.workload.observedPeakMemoryBytes / 1_048_576).toFixed(1)} MiB`;
		const cpu = benchmark.workload.cpuMs === null ? "unavailable" : `${benchmark.workload.cpuMs.toFixed(1)} ms`;
		dependencies.io.stdout(
			`${benchmark.vehicle}: ${benchmark.workload.successCount}/${benchmark.workload.invocations} successful; p50 ${benchmark.workload.latencyMs.p50 ?? "unavailable"} ms, p95 ${benchmark.workload.latencyMs.p95 ?? "unavailable"} ms; cgroup CPU ${cpu}; observed peak memory ${memoryMiB}\n`,
		);
		dependencies.io.stdout(
			`idle control: ${benchmark.idle.wallMs.toFixed(1)} ms; CPU ${benchmark.idle.cpuMs?.toFixed(1) ?? "unavailable"} ms\n`,
		);
		return benchmark.workload.failureCount === 0 ? 0 : 1;
	}
	const inspected = await dependencies.manager.inspect(decoded.manifest.vehicles);
	if (!inspected.ok) {
		writeDiagnostics(inspected.diagnostics, parsed.arguments.json, dependencies.io);
		return 1;
	}
	const strategy = strategyForNativeManager(dependencies.manager.kind);
	const planned = planFleet(decoded.manifest, inspected.services, strategy);
	if (!planned.ok) {
		writeDiagnostics(planned.diagnostics, parsed.arguments.json, dependencies.io);
		return 1;
	}
	if (command === "remove") {
		const vehicle = decoded.manifest.vehicles.find((item) => item.name === parsed.arguments.vehicle);
		if (!vehicle || !dependencies.controller) {
			writeDiagnostics(
				[diagnostic("REMOVE_VEHICLE_UNKNOWN", "error", "/vehicle", "remove requires a declared Vehicle and native controller")],
				parsed.arguments.json,
				dependencies.io,
			);
			return 2;
		}
		const generated = strategyForNativeManager(dependencies.controller.kind).generateDescriptor(vehicle);
		if (!generated.ok) {
			writeDiagnostics(generated.diagnostics, parsed.arguments.json, dependencies.io);
			return 1;
		}
		const removedNative = await dependencies.controller.remove(generated.descriptor.identity);
		if (!removedNative.ok) {
			writeDiagnostics(removedNative.diagnostics, parsed.arguments.json, dependencies.io);
			return 1;
		}
		const removedManifest = await removeManifestVehicle(parsed.arguments.manifestPath, vehicle.name);
		if (!removedManifest.ok) {
			writeDiagnostics(removedManifest.diagnostics, parsed.arguments.json, dependencies.io);
			return 1;
		}
		dependencies.io.stdout(`${JSON.stringify({ ok: true, removed: vehicle.name })}\n`);
		return 0;
	}
	if (command === "cleanup") {
		const vehicle = decoded.manifest.vehicles.find((item) => item.name === parsed.arguments.vehicle);
		if (!vehicle) {
			writeDiagnostics(
				[diagnostic("CLEANUP_VEHICLE_UNKNOWN", "error", "/vehicle", "cleanup requires a declared Vehicle name")],
				parsed.arguments.json,
				dependencies.io,
			);
			return 2;
		}
		const inspectProcesses =
			dependencies.inspectProcesses ?? (() => inspectHostProcesses(dependencies.platform ?? process.platform, processCommandRunner));
		const processes = await inspectProcesses();
		const handles = await readVehicleHandles(decoded.manifest.vehicles, dependencies.readHandle ?? readVehicleHandleFile);
		const native = inspected.services.find((service) => service.name === vehicle.name);
		const cleanup = planDuplicateCleanup(vehicle, native?.pid, handles.get(vehicle.name), processes);
		if (!cleanup.ok) {
			writeDiagnostics(cleanup.diagnostics, parsed.arguments.json, dependencies.io);
			return 1;
		}
		if (parsed.arguments.approval === undefined) {
			dependencies.io.stdout(`${JSON.stringify({ ok: true, plan: cleanup.plan })}\n`);
			return 0;
		}
		const executed = await executeCleanup({
			plan: cleanup.plan,
			approval: parsed.arguments.approval,
			vehicle,
			managedPid: native?.pid,
			handle: handles.get(vehicle.name),
			currentProcesses: inspectProcesses,
			terminate: (pid) => {
				try {
					process.kill(pid, "SIGTERM");
					return Promise.resolve({ ok: true, diagnostics: [] });
				} catch (error) {
					return Promise.resolve({
						ok: false,
						diagnostics: [
							diagnostic("CLEANUP_SIGNAL_FAILED", "error", `/processes/${pid}`, error instanceof Error ? error.message : String(error)),
						],
					});
				}
			},
		});
		if (!executed.ok) {
			writeDiagnostics(executed.diagnostics, parsed.arguments.json, dependencies.io);
			return 1;
		}
		dependencies.io.stdout(`${JSON.stringify({ ok: true, terminatedPids: executed.terminatedPids })}\n`);
		return 0;
	}
	if (command === "restart") {
		const vehicle = decoded.manifest.vehicles.find((item) => item.name === parsed.arguments.vehicle);
		if (!vehicle || !dependencies.controller) {
			writeDiagnostics(
				[diagnostic("RESTART_VEHICLE_UNKNOWN", "error", "/vehicle", "restart requires a declared Vehicle and native controller")],
				parsed.arguments.json,
				dependencies.io,
			);
			return 2;
		}
		const restarted = await restartVehicle(vehicle.name, decoded.manifest, strategy, {
			controller: dependencies.controller,
			readiness: dependencies.readiness ?? createHandleReadinessProbe(),
		});
		if (!restarted.ok) {
			writeDiagnostics(restarted.diagnostics, parsed.arguments.json, dependencies.io);
			return 1;
		}
		if (parsed.arguments.json) {
			dependencies.io.stdout(`${JSON.stringify({ ok: true, restarted: vehicle.name, diagnostics: restarted.diagnostics })}\n`);
			return 0;
		}
		dependencies.io.stdout(`restarted: ${vehicle.name} via ${dependencies.controller.kind}\n`);
		return 0;
	}
	if (command === "status" || command === "doctor") {
		const processes = await (
			dependencies.inspectProcesses ?? (() => inspectHostProcesses(dependencies.platform ?? process.platform, processCommandRunner))
		)();
		const handles = await readVehicleHandles(decoded.manifest.vehicles, dependencies.readHandle ?? readVehicleHandleFile);
		const report = buildFleetStatus({
			manifest: decoded.manifest,
			nativeServices: inspected.services,
			processes,
			handles,
			strategy,
			executableExists: dependencies.executableExists ?? existsSync,
		});
		const hasErrors = report.diagnostics.some((item) => item.severity === "error");
		if (parsed.arguments.json) {
			dependencies.io.stdout(
				`${JSON.stringify({ ok: command === "status" || !hasErrors, manager: dependencies.manager.kind, ...report })}\n`,
			);
		} else if (command === "status") {
			for (const vehicle of report.vehicles)
				dependencies.io.stdout(`${vehicle.name}: ${vehicle.nativeStatus}${vehicle.ready ? " ready" : " not-ready"}\n`);
			writeDiagnostics(report.diagnostics, false, dependencies.io);
		} else {
			writeDiagnostics(report.diagnostics, false, dependencies.io);
			if (report.diagnostics.length === 0) dependencies.io.stdout("doctor: healthy\n");
		}
		return command === "doctor" && hasErrors ? 1 : 0;
	}
	if (command === "plan") {
		if (parsed.arguments.json) {
			dependencies.io.stdout(`${JSON.stringify({ ok: true, manager: dependencies.manager.kind, ...planned.plan })}\n`);
			return 0;
		}
		dependencies.io.stdout(`plan: ${planned.plan.operations.length} operation(s) via ${dependencies.manager.kind}\n`);
		for (const operation of planned.plan.operations) dependencies.io.stdout(`  ${operation.kind} ${operation.name}\n`);
		return 0;
	}
	if (!dependencies.controller) {
		writeDiagnostics(
			[diagnostic("NATIVE_CONTROLLER_REQUIRED", "error", "/", "reconcile requires a native controller")],
			parsed.arguments.json,
			dependencies.io,
		);
		return 1;
	}
	const reconciled = await reconcileFleet({
		manifest: decoded.manifest,
		plan: planned.plan,
		strategy: strategyForNativeManager(dependencies.controller.kind),
		controller: dependencies.controller,
		readCurrentManifestHash: async () => {
			const current = await readManifest(parsed.arguments.manifestPath);
			return current.ok ? { ok: true, hash: current.manifest.contentHash } : current;
		},
		readiness: dependencies.readiness ?? createHandleReadinessProbe(),
	});
	if (!reconciled.ok) {
		writeDiagnostics(reconciled.diagnostics, parsed.arguments.json, dependencies.io);
		return 1;
	}
	if (parsed.arguments.json) {
		dependencies.io.stdout(
			`${JSON.stringify({ ok: true, manager: dependencies.controller.kind, applied: reconciled.applied, diagnostics: reconciled.diagnostics })}\n`,
		);
		return 0;
	}
	dependencies.io.stdout(`reconciled: ${reconciled.applied.length} operation(s) via ${dependencies.controller.kind}\n`);
	return 0;
}

export function managerKind(platform: NodeJS.Platform): NativeManagerKind {
	if (platform === "darwin") return "launchd";
	if (platform === "win32") return "windows-task-scheduler";
	return "systemd";
}

async function readStandardInput(): Promise<string> {
	const chunks: Buffer[] = [];
	let bytes = 0;
	for await (const chunk of process.stdin) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		bytes += buffer.length;
		if (bytes > MAX_MANIFEST_BYTES) throw new Error("Vehicle input exceeds 1 MiB");
		chunks.push(buffer);
	}
	return Buffer.concat(chunks, bytes).toString("utf8");
}

export function isCliEntrypoint(modulePath: string, argumentPath: string | undefined): boolean {
	if (argumentPath === undefined) return false;
	try {
		return realpathSync(modulePath) === realpathSync(argumentPath);
	} catch {
		return false;
	}
}

if (isCliEntrypoint(fileURLToPath(import.meta.url), process.argv[1])) {
	const kind = managerKind(process.platform);
	const controller = createNativeController({ kind, descriptorRoot: defaultDescriptorRoot(kind) });
	process.exitCode = await runCli(process.argv.slice(2), {
		manager: controller,
		controller,
		readInput: readStandardInput,
		io: {
			stdout: (text) => process.stdout.write(text),
			stderr: (text) => process.stderr.write(text),
		},
	});
}
