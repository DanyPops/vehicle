import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import type { CommandRunner } from "../native/controller.js";

const MAX_COUNTER_FILE_BYTES = 64 * 1024;

export interface ResourceSnapshot {
	readonly timestampMs: number;
	readonly cpuUsec: number | null;
	readonly memoryCurrentBytes: number | null;
	readonly memoryPeakBytes: number | null;
	readonly ioReadBytes: number | null;
	readonly ioWriteBytes: number | null;
	readonly pidsCurrent: number | null;
}

export interface WorkloadRunOptions {
	readonly deadlineMs: number;
	readonly maxOutputBytes: number;
}

export type WorkloadOutcome =
	| {
			readonly ok: true;
			readonly durationMs: number;
			readonly stdoutBytes: number;
			readonly stderrBytes: number;
			readonly outputDigest: string;
	  }
	| {
			readonly ok: false;
			readonly durationMs: number;
			readonly stdoutBytes: number;
			readonly stderrBytes: number;
			readonly outputDigest: string;
			readonly errorCode: "DEADLINE" | "EXIT_NONZERO" | "OUTPUT_LIMIT" | "SPAWN_FAILED";
	  };

export interface WorkloadRunner {
	run(options: WorkloadRunOptions): Promise<WorkloadOutcome>;
}

export interface BenchmarkOptions {
	readonly vehicle: string;
	readonly warmup: number;
	readonly repetitions: number;
	readonly concurrency: number;
	readonly deadlineMs: number;
	readonly sampleIntervalMs: number;
	readonly maxOutputBytes: number;
}

export interface BenchmarkDependencies {
	readonly sample: () => Promise<ResourceSnapshot>;
	readonly workload: WorkloadRunner;
	readonly now?: () => number;
	readonly sleep?: (milliseconds: number) => Promise<void>;
}

export interface ResourceWindowSummary {
	readonly wallMs: number;
	readonly cpuMs: number | null;
	readonly memoryStartBytes: number | null;
	readonly memoryEndBytes: number | null;
	readonly observedPeakMemoryBytes: number | null;
	readonly historicalPeakMemoryBytes: number | null;
	readonly ioReadBytes: number | null;
	readonly ioWriteBytes: number | null;
	readonly peakPids: number | null;
}

export interface BenchmarkResult {
	readonly schemaVersion: 1;
	readonly vehicle: string;
	readonly configuration: Omit<BenchmarkOptions, "vehicle">;
	readonly counters: {
		readonly supported: readonly ("cpu" | "memory" | "io" | "pids")[];
		readonly unavailable: readonly ("cpu" | "memory" | "io" | "pids")[];
	};
	readonly workload: ResourceWindowSummary & {
		readonly invocations: number;
		readonly successCount: number;
		readonly failureCount: number;
		readonly failureCodes: Readonly<Record<string, number>>;
		readonly idleAdjustedCpuMs: number | null;
		readonly outputBytes: number;
		readonly outputDigest: string;
		readonly latencyMs: { readonly p50: number | null; readonly p95: number | null; readonly max: number | null };
	};
	readonly idle: ResourceWindowSummary;
}

export interface SystemdBenchmarkRequest extends BenchmarkOptions {
	readonly unit: string;
	readonly command: string;
	readonly arguments: readonly string[];
	readonly cgroupRoot?: string;
}

async function readBoundedCounter(path: string): Promise<string | null> {
	try {
		const stat = await lstat(path);
		if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_COUNTER_FILE_BYTES) return null;
		return await readFile(path, "utf8");
	} catch {
		return null;
	}
}

function nonNegativeInteger(value: string | undefined): number | null {
	if (value === undefined || !/^\d+$/.test(value)) return null;
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) ? parsed : null;
}

function cpuUsec(text: string | null): number | null {
	if (text === null) return null;
	for (const line of text.split(/\r?\n/)) {
		const [name, value] = line.trim().split(/\s+/, 2);
		if (name === "usage_usec") return nonNegativeInteger(value);
	}
	return null;
}

function ioBytes(text: string | null): { readonly read: number | null; readonly write: number | null } {
	if (text === null) return { read: null, write: null };
	let read = 0;
	let write = 0;
	let found = false;
	for (const line of text.split(/\r?\n/)) {
		const readMatch = /(?:^|\s)rbytes=(\d+)(?:\s|$)/.exec(line);
		const writeMatch = /(?:^|\s)wbytes=(\d+)(?:\s|$)/.exec(line);
		const readValue = nonNegativeInteger(readMatch?.[1]);
		const writeValue = nonNegativeInteger(writeMatch?.[1]);
		if (readValue !== null) {
			read += readValue;
			found = true;
		}
		if (writeValue !== null) {
			write += writeValue;
			found = true;
		}
	}
	return found && Number.isSafeInteger(read) && Number.isSafeInteger(write) ? { read, write } : { read: null, write: null };
}

function cgroupPath(root: string, controlGroup: string): string {
	if (!controlGroup.startsWith("/") || controlGroup.split("/").includes("..")) throw new Error("invalid control group path");
	const normalizedRoot = resolve(root);
	const path = resolve(normalizedRoot, controlGroup.slice(1));
	if (path !== normalizedRoot && !path.startsWith(`${normalizedRoot}${sep}`)) throw new Error("control group escapes cgroup root");
	return path;
}

/** Reads hierarchical cgroup-v2 counters for one complete supervised service process tree. */
export async function readLinuxCgroupResourceSnapshot(
	root: string,
	controlGroup: string,
	timestampMs: number = performance.now(),
): Promise<ResourceSnapshot> {
	const path = cgroupPath(root, controlGroup);
	const [cpu, memoryCurrent, memoryPeak, io, pids] = await Promise.all([
		readBoundedCounter(resolve(path, "cpu.stat")),
		readBoundedCounter(resolve(path, "memory.current")),
		readBoundedCounter(resolve(path, "memory.peak")),
		readBoundedCounter(resolve(path, "io.stat")),
		readBoundedCounter(resolve(path, "pids.current")),
	]);
	const parsedIo = ioBytes(io);
	return {
		timestampMs,
		cpuUsec: cpuUsec(cpu),
		memoryCurrentBytes: nonNegativeInteger(memoryCurrent?.trim()),
		memoryPeakBytes: nonNegativeInteger(memoryPeak?.trim()),
		ioReadBytes: parsedIo.read,
		ioWriteBytes: parsedIo.write,
		pidsCurrent: nonNegativeInteger(pids?.trim()),
	};
}

/** Executes one workload directly, with no shell, while retaining only bounded byte counts and a digest. */
export function createProcessWorkloadRunner(command: string, arguments_: readonly string[]): WorkloadRunner {
	return {
		run(options) {
			const started = performance.now();
			return new Promise((resolveOutcome) => {
				execFile(
					command,
					[...arguments_],
					{ encoding: "utf8", maxBuffer: options.maxOutputBytes, timeout: Math.max(1, Math.floor(options.deadlineMs)), windowsHide: true },
					(error, stdout, stderr) => {
						const durationMs = Math.max(0, performance.now() - started);
						const stdoutBytes = Buffer.byteLength(stdout);
						const stderrBytes = Buffer.byteLength(stderr);
						const outputDigest = createHash("sha256").update(stdout).update("\0").update(stderr).digest("hex");
						if (!error) {
							resolveOutcome({ ok: true, durationMs, stdoutBytes, stderrBytes, outputDigest });
							return;
						}
						const details = error as NodeJS.ErrnoException & { killed?: boolean };
						const errorCode =
							details.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER"
								? "OUTPUT_LIMIT"
								: details.killed
									? "DEADLINE"
									: typeof details.code === "number"
										? "EXIT_NONZERO"
										: "SPAWN_FAILED";
						resolveOutcome({ ok: false, durationMs, stdoutBytes, stderrBytes, outputDigest, errorCode });
					},
				);
			});
		},
	};
}

function difference(after: number | null, before: number | null): number | null {
	return after === null || before === null ? null : Math.max(0, after - before);
}

function maximum(values: readonly (number | null)[]): number | null {
	const present = values.filter((value): value is number => value !== null);
	return present.length === 0 ? null : Math.max(...present);
}

function summarizeWindow(samples: readonly ResourceSnapshot[]): ResourceWindowSummary {
	const start = samples[0];
	const end = samples.at(-1);
	if (!start || !end) throw new Error("resource window requires boundary samples");
	const cpuDifference = difference(end.cpuUsec, start.cpuUsec);
	return {
		wallMs: Math.max(0, end.timestampMs - start.timestampMs),
		cpuMs: cpuDifference === null ? null : cpuDifference / 1_000,
		memoryStartBytes: start.memoryCurrentBytes,
		memoryEndBytes: end.memoryCurrentBytes,
		observedPeakMemoryBytes: maximum(samples.map((sample) => sample.memoryCurrentBytes)),
		historicalPeakMemoryBytes: maximum(samples.map((sample) => sample.memoryPeakBytes)),
		ioReadBytes: difference(end.ioReadBytes, start.ioReadBytes),
		ioWriteBytes: difference(end.ioWriteBytes, start.ioWriteBytes),
		peakPids: maximum(samples.map((sample) => sample.pidsCurrent)),
	};
}

async function observe<T>(
	action: () => Promise<T>,
	sample: () => Promise<ResourceSnapshot>,
	sleep: (milliseconds: number) => Promise<void>,
	sampleIntervalMs: number,
): Promise<{ readonly value: T; readonly samples: readonly ResourceSnapshot[] }> {
	const samples: ResourceSnapshot[] = [await sample()];
	let settled = false;
	const actionPromise = action().finally(() => {
		settled = true;
	});
	while (!settled) {
		await Promise.race([sleep(sampleIntervalMs), actionPromise.then(() => undefined)]);
		if (!settled) samples.push(await sample());
	}
	const value = await actionPromise;
	samples.push(await sample());
	return { value, samples };
}

function percentile(values: readonly number[], proportion: number): number | null {
	if (values.length === 0) return null;
	const sorted = [...values].sort((left, right) => left - right);
	return sorted[Math.max(0, Math.ceil(sorted.length * proportion) - 1)] ?? null;
}

function aggregateDigest(outcomes: readonly WorkloadOutcome[]): string {
	const hash = createHash("sha256");
	for (const outcome of outcomes) hash.update(outcome.outputDigest).update("\0");
	return hash.digest("hex");
}

async function invokeRounds(
	rounds: number,
	concurrency: number,
	workload: WorkloadRunner,
	deadlineAt: number,
	now: () => number,
	maxOutputBytes: number,
): Promise<readonly WorkloadOutcome[]> {
	const outcomes: WorkloadOutcome[] = [];
	for (let round = 0; round < rounds; round++) {
		const remaining = Math.max(0, deadlineAt - now());
		if (remaining === 0) {
			for (let index = round * concurrency; index < rounds * concurrency; index++) {
				outcomes.push({
					ok: false,
					durationMs: 0,
					stdoutBytes: 0,
					stderrBytes: 0,
					outputDigest: createHash("sha256").update("").digest("hex"),
					errorCode: "DEADLINE",
				});
			}
			break;
		}
		outcomes.push(
			...(await Promise.all(Array.from({ length: concurrency }, () => workload.run({ deadlineMs: remaining, maxOutputBytes })))),
		);
	}
	return outcomes;
}

/** Benchmarks bounded workload rounds and an equal-duration idle control against one cgroup sampler. */
export async function benchmarkService(options: BenchmarkOptions, dependencies: BenchmarkDependencies): Promise<BenchmarkResult> {
	const now = dependencies.now ?? (() => performance.now());
	const sleep = dependencies.sleep ?? ((milliseconds: number) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds)));
	const deadlineAt = now() + options.deadlineMs;
	await invokeRounds(options.warmup, options.concurrency, dependencies.workload, deadlineAt, now, options.maxOutputBytes);
	const measured = await observe(
		() => invokeRounds(options.repetitions, options.concurrency, dependencies.workload, deadlineAt, now, options.maxOutputBytes),
		dependencies.sample,
		sleep,
		options.sampleIntervalMs,
	);
	const workloadWindow = summarizeWindow(measured.samples);
	const idleStart = await dependencies.sample();
	await sleep(workloadWindow.wallMs);
	const idleWindow = summarizeWindow([idleStart, await dependencies.sample()]);
	const successful = measured.value.filter((outcome) => outcome.ok).length;
	const failureCodes: Record<string, number> = {};
	for (const outcome of measured.value) {
		if (!outcome.ok) failureCodes[outcome.errorCode] = (failureCodes[outcome.errorCode] ?? 0) + 1;
	}
	const latencies = measured.value.map((outcome) => outcome.durationMs);
	const idleCpuAtWorkloadDuration =
		workloadWindow.cpuMs === null || idleWindow.cpuMs === null || idleWindow.wallMs === 0
			? null
			: (idleWindow.cpuMs * workloadWindow.wallMs) / idleWindow.wallMs;
	const idleAdjustedCpuMs =
		workloadWindow.cpuMs === null || idleCpuAtWorkloadDuration === null
			? null
			: Math.max(0, workloadWindow.cpuMs - idleCpuAtWorkloadDuration);
	const supported = [
		...(workloadWindow.cpuMs === null ? [] : (["cpu"] as const)),
		...(workloadWindow.memoryStartBytes === null ? [] : (["memory"] as const)),
		...(workloadWindow.ioReadBytes === null ? [] : (["io"] as const)),
		...(workloadWindow.peakPids === null ? [] : (["pids"] as const)),
	];
	const allCounters = ["cpu", "memory", "io", "pids"] as const;
	return {
		schemaVersion: 1,
		vehicle: options.vehicle,
		configuration: {
			warmup: options.warmup,
			repetitions: options.repetitions,
			concurrency: options.concurrency,
			deadlineMs: options.deadlineMs,
			sampleIntervalMs: options.sampleIntervalMs,
			maxOutputBytes: options.maxOutputBytes,
		},
		counters: { supported, unavailable: allCounters.filter((counter) => !supported.includes(counter)) },
		workload: {
			...workloadWindow,
			invocations: measured.value.length,
			successCount: successful,
			failureCount: measured.value.length - successful,
			failureCodes,
			idleAdjustedCpuMs,
			outputBytes: measured.value.reduce((total, outcome) => total + outcome.stdoutBytes + outcome.stderrBytes, 0),
			outputDigest: aggregateDigest(measured.value),
			latencyMs: { p50: percentile(latencies, 0.5), p95: percentile(latencies, 0.95), max: maximum(latencies) },
		},
		idle: idleWindow,
	};
}

export async function resolveSystemdControlGroup(unit: string, runner: CommandRunner): Promise<string> {
	const outcome = await runner.run("systemctl", ["--user", "show", unit, "--property=ControlGroup", "--value", "--no-pager"]);
	if (!outcome.ok) throw new Error("unable to inspect supervised service cgroup");
	const controlGroup = outcome.stdout.trim();
	if (!controlGroup.startsWith("/")) throw new Error("supervised service has no control group");
	return controlGroup;
}

/** Runs the production Linux/systemd benchmark path. Workload command details are intentionally absent from the returned result. */
export async function benchmarkSystemdService(request: SystemdBenchmarkRequest, runner: CommandRunner): Promise<BenchmarkResult> {
	const controlGroup = await resolveSystemdControlGroup(request.unit, runner);
	const cgroupRoot = request.cgroupRoot ?? "/sys/fs/cgroup";
	return benchmarkService(request, {
		sample: () => readLinuxCgroupResourceSnapshot(cgroupRoot, controlGroup),
		workload: createProcessWorkloadRunner(request.command, request.arguments),
	});
}
