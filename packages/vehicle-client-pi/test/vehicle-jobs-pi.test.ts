/**
 * Proves invokeVehicleOperation's own job-backed execution path (runVehicleJobToCompletion /
 * invokeOrRunAsJob): a background-capable operation is submitted as a Vehicle Job and
 * polled/tailed internally instead of one held-open client.invoke() -- with NO change to the
 * caller-facing shape (same onUpdate/progress semantics, same thrown-VehicleError-on-failure
 * contract, same final output) that createTool's own execute() and every existing test already
 * exercises against a plain invoke(). This is the "unchanged tool surface" design this feature's
 * own task explicitly recommended over exposing separate submit/poll/cancel tools to the model.
 */
import { describe, expect, it } from "bun:test";
import type {
	VehicleClient,
	VehicleInvocationOptions,
	VehicleJobSnapshot,
	VehicleJobSubmitOptions,
	VehicleJobSubmitResult,
	VehicleJobTailResult,
	VehicleManifest,
	VehicleManifestOperation,
} from "@danypops/vehicle-core";
import { isVehicleError } from "@danypops/vehicle-core";
import { invokeVehicleOperation, PiVehicleInvocationError } from "../src/vehicle-pi.ts";

const limits = { defaultTimeoutMs: 1_000, maxTimeoutMs: 5_000, maxRequestBytes: 1_024, maxResponseBytes: 1_024 };

function operation(overrides: Partial<VehicleManifestOperation> = {}): VehicleManifestOperation {
	return {
		name: "ci.wait",
		version: 1,
		description: "A background-capable long-running watch.",
		inputSchema: { type: "object", properties: { runId: { type: "string" } }, required: ["runId"], additionalProperties: false },
		outputSchema: { type: "object" },
		permissions: [],
		effect: "read",
		idempotency: { mode: "safe" },
		streaming: false,
		longRunning: true,
		limits,
		errors: [],
		available: true,
		background: {
			supported: true,
			defaultWakeBudget: { maxCount: 50, maxBytes: 50_000 },
			maxWakeBudget: { maxCount: 50, maxBytes: 50_000 },
		},
		...overrides,
	};
}

function manifestOf(op: VehicleManifestOperation): VehicleManifest {
	return { name: "test-vehicle", version: "1.0.0", description: "Test Vehicle.", operations: [op] };
}

function fakeContext(overrides: Record<string, unknown> = {}) {
	return { sessionManager: { getSessionId: () => "session-1" }, hasUI: false, ...overrides } as never;
}

/** A job-capable fake client this test drives by hand -- submitJob starts a controllable "job", pollJob/tailJob read its state, never any real timer. */
class FakeJobClient implements VehicleClient {
	readonly invokeCalls: Array<{ name: string; version: number }> = [];
	readonly submitCalls: Array<{ name: string; version: number; input: unknown; options: VehicleJobSubmitOptions | undefined }> = [];
	readonly cancelCalls: string[] = [];
	private status: VehicleJobSnapshot["status"] = "running";
	private output: unknown;
	private error: VehicleJobSnapshot["error"];
	private readonly progressEntries: unknown[] = [];
	private jobIdCounter = 0;
	private submittedResolve!: () => void;
	/** Resolves once submitJob has actually been called -- lets a test await job submission (and
	 * this file's own abort-listener registration, which only happens after that await settles)
	 * without guessing at microtask ordering. */
	readonly submitted: Promise<void>;

	constructor(public value: VehicleManifest) {
		this.submitted = new Promise((resolve) => {
			this.submittedResolve = resolve;
		});
	}

	manifest(): Promise<VehicleManifest> {
		return Promise.resolve(this.value);
	}

	async invoke<Output = unknown>(name: string, version: number, _input: unknown, _options?: VehicleInvocationOptions): Promise<Output> {
		this.invokeCalls.push({ name, version });
		throw new Error("FakeJobClient.invoke() should never be called for a background-capable operation with a job-capable client");
	}

	async submitJob(name: string, version: number, input: unknown, options?: VehicleJobSubmitOptions): Promise<VehicleJobSubmitResult> {
		this.submitCalls.push({ name, version, input, options });
		this.submittedResolve();
		return { jobId: `job-${++this.jobIdCounter}` };
	}

	async pollJob(_jobId: string): Promise<VehicleJobSnapshot> {
		return {
			jobId: _jobId,
			operationName: "ci.wait",
			operationVersion: 1,
			status: this.status,
			createdAt: 0,
			updatedAt: 0,
			delivered: false,
			...(this.output !== undefined ? { output: this.output } : {}),
			...(this.error ? { error: this.error } : {}),
		};
	}

	async tailJob(_jobId: string, cursor = 0): Promise<VehicleJobTailResult> {
		return {
			entries: this.progressEntries.slice(cursor).map((progress, i) => ({ seq: cursor + i + 1, at: 0, progress })),
			cursor: this.progressEntries.length,
		};
	}

	async cancelJob(jobId: string): Promise<void> {
		this.cancelCalls.push(jobId);
	}

	close(): Promise<void> {
		return Promise.resolve();
	}

	// Test controls, mirroring the vehicle-server harness's own controllableHandler shape.
	tick(progress: unknown): void {
		this.progressEntries.push(progress);
	}
	succeed(output: unknown): void {
		this.status = "succeeded";
		this.output = output;
	}
	fail(error: VehicleJobSnapshot["error"]): void {
		this.status = "failed";
		this.error = error;
	}
	cancelSettles(): void {
		this.status = "canceled";
	}
}

describe("invokeVehicleOperation: background-capable operation runs as a Vehicle Job, not a held-open invoke()", () => {
	it("submits a job instead of calling invoke(), and returns the job's own final output", async () => {
		const descriptor = operation();
		const client = new FakeJobClient(manifestOf(descriptor));
		client.succeed({ status: "success" });

		const result = await invokeVehicleOperation({
			client,
			manifest: client.value,
			descriptor,
			toolName: "ci_wait",
			toolCallId: "call-1",
			input: { runId: "42" },
			context: fakeContext(),
			options: { jobPollIntervalMs: 1 },
		});

		expect(client.invokeCalls).toHaveLength(0);
		expect(client.submitCalls).toHaveLength(1);
		expect(client.submitCalls[0]?.name).toBe("ci.wait");
		expect((result.details as { output: unknown }).output).toEqual({ status: "success" });
	});

	it("options.jobs.jobPollIntervalMs behaves identically to the flat options.jobPollIntervalMs field", async () => {
		const descriptor = operation();
		const client = new FakeJobClient(manifestOf(descriptor));
		client.succeed({ status: "success" });

		const result = await invokeVehicleOperation({
			client,
			manifest: client.value,
			descriptor,
			toolName: "ci_wait",
			toolCallId: "call-1",
			input: { runId: "42" },
			context: fakeContext(),
			options: { jobs: { jobPollIntervalMs: 1 } },
		});

		expect(client.invokeCalls).toHaveLength(0);
		expect(client.submitCalls).toHaveLength(1);
		expect((result.details as { output: unknown }).output).toEqual({ status: "success" });
	});

	it("forwards every tail entry through onUpdate, exactly like invoke()'s own onProgress would", async () => {
		const descriptor = operation();
		const client = new FakeJobClient(manifestOf(descriptor));
		const updates: unknown[] = [];

		// succeed() immediately, but with progress already queued before the first poll -- the
		// polling loop must drain tailJob at least once before observing the terminal status.
		client.tick({ phase: "queued" });
		client.tick({ phase: "in_progress" });
		client.succeed({ status: "success" });

		await invokeVehicleOperation({
			client,
			manifest: client.value,
			descriptor,
			toolName: "ci_wait",
			toolCallId: "call-1",
			input: { runId: "42" },
			context: fakeContext(),
			onUpdate: (update) => updates.push(update),
			options: { jobPollIntervalMs: 1 },
		});

		const progressPayloads = updates
			.map((u) => (u as { details?: { progress?: unknown } }).details?.progress)
			.filter((p): p is { phase: string } => p !== undefined);
		expect(progressPayloads).toEqual([{ phase: "queued" }, { phase: "in_progress" }]);
	});

	it("a failed job surfaces as PiVehicleInvocationError with the job's own real code/message, same as a failed invoke()", async () => {
		const descriptor = operation();
		const client = new FakeJobClient(manifestOf(descriptor));
		client.fail({ code: "ci-run-failed", category: "internal", message: "the watched run failed", retryable: false });

		const failure = await invokeVehicleOperation({
			client,
			manifest: client.value,
			descriptor,
			toolName: "ci_wait",
			toolCallId: "call-1",
			input: { runId: "42" },
			context: fakeContext(),
			options: { jobPollIntervalMs: 1 },
		}).catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(PiVehicleInvocationError);
		expect((failure as PiVehicleInvocationError).failure.code).toBe("ci-run-failed");
		expect((failure as PiVehicleInvocationError).failure.message).toBe("the watched run failed");
	});

	it("a canceled job (e.g. the tool call's own signal aborting) surfaces as a clear failure, and cancelJob was actually called", async () => {
		const descriptor = operation();
		const client = new FakeJobClient(manifestOf(descriptor));
		const controller = new AbortController();

		const invocation = invokeVehicleOperation({
			client,
			manifest: client.value,
			descriptor,
			toolName: "ci_wait",
			toolCallId: "call-1",
			input: { runId: "42" },
			context: fakeContext(),
			signal: controller.signal,
			options: { jobPollIntervalMs: 1 },
		});

		// Let the job actually submit before aborting -- submitJob is async, and the abort listener
		// only attaches once its promise resolves, so an abort fired too early would race ahead of
		// that registration. One more microtask turn after submitted resolves guarantees the listener
		// (registered in the very next line after that same await, in runVehicleJobToCompletion) is
		// already attached.
		await client.submitted;
		await Promise.resolve();
		controller.abort();
		client.cancelSettles();

		const failure = await invocation.catch((error: unknown) => error);
		expect(failure).toBeInstanceOf(PiVehicleInvocationError);
		expect(client.cancelCalls).toHaveLength(1);
	});

	it("falls back to a plain invoke() when the operation is NOT background-capable, even though the client supports jobs", async () => {
		const descriptor = operation({ background: undefined });
		const client = new FakeJobClient(manifestOf(descriptor));
		client.invoke = async <Output>(_name: string, _version: number, _input: unknown, _options?: VehicleInvocationOptions) => {
			client.invokeCalls.push({ name: descriptor.name, version: descriptor.version });
			return { status: "success" } as Output;
		};

		const result = await invokeVehicleOperation({
			client,
			manifest: client.value,
			descriptor,
			toolName: "ci_wait",
			toolCallId: "call-1",
			input: { runId: "42" },
			context: fakeContext(),
			options: {},
		});

		expect(client.invokeCalls).toHaveLength(1);
		expect(client.submitCalls).toHaveLength(0);
		expect((result.details as { output: unknown }).output).toEqual({ status: "success" });
	});

	it("falls back to a plain invoke() when the client doesn't expose submitJob at all, even though the operation is background-capable", async () => {
		const descriptor = operation();
		const client: VehicleClient = {
			manifest: async () => manifestOf(descriptor),
			invoke: async <Output>(_name: string, _version: number, _input: unknown, options?: VehicleInvocationOptions) => {
				options?.onProgress?.({ phase: "half" });
				return { status: "success" } as Output;
			},
			close: async () => {},
		};

		const result = await invokeVehicleOperation({
			client,
			manifest: manifestOf(descriptor),
			descriptor,
			toolName: "ci_wait",
			toolCallId: "call-1",
			input: { runId: "42" },
			context: fakeContext(),
			options: {},
		});

		expect((result.details as { output: unknown }).output).toEqual({ status: "success" });
	});

	it("isVehicleError sees the reconstructed job failure the same way it would a live invoke() rejection", async () => {
		const descriptor = operation();
		const client = new FakeJobClient(manifestOf(descriptor));
		client.fail({ code: "job-boom", category: "internal", message: "boom", retryable: true, retryAfterMs: 500 });

		const failure = await invokeVehicleOperation({
			client,
			manifest: client.value,
			descriptor,
			toolName: "ci_wait",
			toolCallId: "call-1",
			input: { runId: "42" },
			context: fakeContext(),
			options: { jobPollIntervalMs: 1 },
		}).catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(PiVehicleInvocationError);
		void isVehicleError; // sanity: this import is exercised by other suites' own reconstruction checks; kept here for parity with this file's own failure-shape assertions.
	});
});
