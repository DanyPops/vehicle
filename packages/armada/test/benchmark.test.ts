import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	benchmarkService,
	createProcessWorkloadRunner,
	type ResourceSnapshot,
	readLinuxCgroupResourceSnapshot,
} from "../src/fleet/benchmark.js";

const createdDirs: string[] = [];
afterEach(async () => {
	await Promise.all(createdDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function tempDir(): Promise<string> {
	const directory = await mkdtemp(join(tmpdir(), "armada-benchmark-"));
	createdDirs.push(directory);
	return directory;
}

describe("Linux cgroup resource sampling", () => {
	it("reads hierarchical service counters with explicit unavailable values", async () => {
		const root = await tempDir();
		const group = join(root, "user.slice", "armada-synthetic.service");
		await mkdir(group, { recursive: true });
		await writeFile(join(group, "cpu.stat"), "usage_usec 1250\nuser_usec 1000\nsystem_usec 250\n");
		await writeFile(join(group, "memory.current"), "4096\n");
		await writeFile(join(group, "memory.peak"), "8192\n");
		await writeFile(join(group, "pids.current"), "3\n");
		await writeFile(join(group, "io.stat"), "8:0 rbytes=100 wbytes=40 rios=1 wios=1\n8:1 rbytes=25 wbytes=2 rios=1 wios=1\n");

		const snapshot = await readLinuxCgroupResourceSnapshot(root, "/user.slice/armada-synthetic.service", 123);
		expect(snapshot).toEqual({
			timestampMs: 123,
			cpuUsec: 1250,
			memoryCurrentBytes: 4096,
			memoryPeakBytes: 8192,
			ioReadBytes: 125,
			ioWriteBytes: 42,
			pidsCurrent: 3,
		});
		await rm(join(group, "io.stat"));
		expect(await readLinuxCgroupResourceSnapshot(root, "/user.slice/armada-synthetic.service", 124)).toMatchObject({
			ioReadBytes: null,
			ioWriteBytes: null,
		});
	});

	it("rejects a control group outside the supplied cgroup root", async () => {
		const root = await tempDir();
		expect(readLinuxCgroupResourceSnapshot(root, "../../etc", 0)).rejects.toThrow("control group");
	});
});

describe("bounded workload execution", () => {
	it("digests output instead of returning command output or arguments", async () => {
		const runner = createProcessWorkloadRunner(process.execPath, ["-e", "process.stdout.write('sensitive-value')"]);
		const outcome = await runner.run({ deadlineMs: 5_000, maxOutputBytes: 1024 });
		expect(outcome).toMatchObject({ ok: true, stdoutBytes: 15, stderrBytes: 0 });
		expect(JSON.stringify(outcome)).not.toContain("sensitive-value");
		expect(JSON.stringify(outcome)).not.toContain("process.stdout");
		expect(outcome.outputDigest).toMatch(/^[a-f0-9]{64}$/);
	});

	it("terminates output that exceeds the configured bound", async () => {
		const runner = createProcessWorkloadRunner(process.execPath, ["-e", "process.stdout.write('x'.repeat(4096))"]);
		expect(await runner.run({ deadlineMs: 5_000, maxOutputBytes: 128 })).toMatchObject({ ok: false, errorCode: "OUTPUT_LIMIT" });
	});

	it("terminates work at its deadline", async () => {
		const runner = createProcessWorkloadRunner(process.execPath, ["-e", "setTimeout(() => {}, 10000)"]);
		expect(await runner.run({ deadlineMs: 20.5, maxOutputBytes: 128 })).toMatchObject({ ok: false, errorCode: "DEADLINE" });
	});
});

describe("service benchmark", () => {
	it("subtracts an equal-duration idle control and bounds invocation concurrency", async () => {
		let timestampMs = 0;
		let cpuUsec = 0;
		let memoryCurrentBytes = 1_000;
		let pidsCurrent = 2;
		let active = 0;
		let peakActive = 0;
		const snapshot = (): ResourceSnapshot => ({
			timestampMs,
			cpuUsec,
			memoryCurrentBytes,
			memoryPeakBytes: 4_000,
			ioReadBytes: cpuUsec,
			ioWriteBytes: cpuUsec / 2,
			pidsCurrent,
		});
		const result = await benchmarkService(
			{
				vehicle: "synthetic",
				warmup: 1,
				repetitions: 2,
				concurrency: 2,
				deadlineMs: 10_000,
				sampleIntervalMs: 10,
				maxOutputBytes: 1024,
			},
			{
				now: () => timestampMs,
				sleep: (milliseconds) => {
					timestampMs += milliseconds;
					cpuUsec += milliseconds * 10;
					return Promise.resolve();
				},
				sample: () => Promise.resolve(snapshot()),
				workload: {
					async run() {
						active++;
						peakActive = Math.max(peakActive, active);
						pidsCurrent = 2 + active;
						memoryCurrentBytes = Math.max(memoryCurrentBytes, 1_000 + active * 500);
						await Promise.resolve();
						timestampMs += 20;
						cpuUsec += 2_000;
						active--;
						pidsCurrent = 2 + active;
						return { ok: true, durationMs: 20, stdoutBytes: 1, stderrBytes: 0, outputDigest: "a".repeat(64) };
					},
				},
			},
		);

		expect(peakActive).toBe(2);
		expect(result.schemaVersion).toBe(1);
		expect(result.configuration).toMatchObject({ warmup: 1, repetitions: 2, concurrency: 2 });
		expect(result.workload).toMatchObject({ invocations: 4, successCount: 4, failureCount: 0 });
		expect(result.idle.wallMs).toBe(result.workload.wallMs);
		expect(result.workload.idleAdjustedCpuMs).toBeGreaterThanOrEqual(0);
		expect(result.workload.latencyMs).toMatchObject({ p50: 20, p95: 20, max: 20 });
		expect(JSON.stringify(result)).not.toContain("sensitive");
	});

	it("names unavailable counters instead of inventing zeroes", async () => {
		let timestampMs = 0;
		const result = await benchmarkService(
			{ vehicle: "synthetic", warmup: 0, repetitions: 1, concurrency: 1, deadlineMs: 1_000, sampleIntervalMs: 10, maxOutputBytes: 128 },
			{
				now: () => timestampMs,
				sleep: (milliseconds) => {
					timestampMs += milliseconds;
					return Promise.resolve();
				},
				sample: () =>
					Promise.resolve({
						timestampMs,
						cpuUsec: null,
						memoryCurrentBytes: null,
						memoryPeakBytes: null,
						ioReadBytes: null,
						ioWriteBytes: null,
						pidsCurrent: null,
					}),
				workload: {
					run: () => {
						timestampMs += 1;
						return Promise.resolve({ ok: true, durationMs: 1, stdoutBytes: 0, stderrBytes: 0, outputDigest: "b".repeat(64) });
					},
				},
			},
		);
		expect(result.counters).toEqual({ supported: [], unavailable: ["cpu", "memory", "io", "pids"] });
		expect(result.workload).toMatchObject({ cpuMs: null, ioReadBytes: null, peakPids: null });
	});
});
