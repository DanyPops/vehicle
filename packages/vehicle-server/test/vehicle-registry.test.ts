import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import {
	bindVehicleOperation,
	defineVehicleEvent,
	defineVehicleOperation,
	defineVehicleSchema,
	type JsonValue,
	VehicleError,
} from "@danypops/vehicle-core";
import {
	bridgeVehicleEventsToPushChannel,
	type VehicleExecutionMiddleware,
	type VehicleExecutionPolicy,
	VehicleRegistry,
} from "../src/vehicle-registry.ts";

function destructiveEchoRegistry(): VehicleRegistry {
	const registry = new VehicleRegistry({ name: "test", version: "1", description: "Test." });
	const operation = defineVehicleOperation({ ...ECHO_OPTIONS, name: "test.destructive-echo", effect: "destructive" });
	registry.register(
		"echo-provider",
		bindVehicleOperation(operation, () => async ({ input }) => ({ echoed: input.value })),
	);
	return registry;
}

async function requestApprovalGate(registry: VehicleRegistry, input: { value: string } = { value: "go" }): Promise<string> {
	const failure = await registry.invoke("test.destructive-echo", 1, input, { permissions: ["test:echo"] }).then(
		() => {
			throw new Error("expected the gated invoke() to reject");
		},
		(error) => error as { details?: { requestId?: string } },
	);
	const requestId = failure.details?.requestId;
	if (!requestId) throw new Error("expected a requestId in the approval-required failure");
	return requestId;
}

const objectSchema = <T extends Record<string, unknown>>(properties: Record<string, JsonValue>, parse: (value: unknown) => T | undefined) =>
	defineVehicleSchema<T>({
		jsonSchema: { type: "object", properties, additionalProperties: false },
		safeParse(value) {
			const parsed = parse(value);
			return parsed ? { success: true, value: parsed } : { success: false, issues: [{ path: [], message: "invalid object" }] };
		},
	});

const inputSchema = objectSchema({ value: { type: "string" } }, (value) =>
	typeof value === "object" && value !== null && typeof (value as { value?: unknown }).value === "string"
		? { value: (value as { value: string }).value }
		: undefined,
);

const outputSchema = objectSchema({ echoed: { type: "string" } }, (value) =>
	typeof value === "object" && value !== null && typeof (value as { echoed?: unknown }).echoed === "string"
		? { echoed: (value as { echoed: string }).echoed }
		: undefined,
);

const ECHO_OPTIONS = {
	name: "test.echo",
	version: 1,
	description: "Echo a string.",
	input: inputSchema,
	output: outputSchema,
	permissions: ["test:echo"],
	effect: "read",
	idempotency: { mode: "safe" },
	limits: {
		defaultTimeoutMs: 1_000,
		maxTimeoutMs: 5_000,
		maxRequestBytes: 1_024,
		maxResponseBytes: 1_024,
	},
} as const;

const Echo = defineVehicleOperation(ECHO_OPTIONS);

function echoBinding(factory?: () => (context: { input: { value: string } }) => Promise<{ echoed: string }>) {
	return bindVehicleOperation(
		Echo,
		factory ??
			(() =>
				async ({ input }) => ({ echoed: input.value })),
	);
}

function registryWith(binding = echoBinding(), policy?: VehicleExecutionPolicy): VehicleRegistry {
	const registry = new VehicleRegistry({ name: "test-vehicle", version: "1.0.0", description: "Vehicle test fixture." }, policy);
	registry.register("echo-provider", binding);
	return registry;
}

describe("Vehicle protocol negotiation", () => {
	it("reports default protocol support and negotiates a compatible offer", () => {
		const registry = registryWith();
		expect(registry.manifest().protocol).toEqual({ minimumVersion: 1, maximumVersion: 1, capabilities: [] });
		expect(
			registry.negotiate({ minimumVersion: 1, maximumVersion: 2, requiredCapabilities: [], optionalCapabilities: ["future"] }),
		).toEqual({ version: 1, capabilities: [] });
	});

	it("surfaces incompatible versions and required capabilities as typed Vehicle errors", () => {
		const registry = new VehicleRegistry({
			name: "test-vehicle",
			version: "1.0.0",
			description: "Vehicle test fixture.",
			protocol: { minimumVersion: 2, maximumVersion: 3, capabilities: ["events"] },
		});
		expect(() => registry.negotiate({ minimumVersion: 1, maximumVersion: 1, requiredCapabilities: [], optionalCapabilities: [] })).toThrow(
			expect.objectContaining({ code: "protocol-version-incompatible" }),
		);
		expect(() => registry.negotiate({ minimumVersion: 2, maximumVersion: 2, requiredCapabilities: ["jobs"], optionalCapabilities: [] })).toThrow(
			expect.objectContaining({ code: "protocol-capability-unsupported" }),
		);
	});
});

describe("Vehicle operation contracts", () => {
	it("keeps the manifest descriptor serializable and executable code in the binding", () => {
		const binding = echoBinding();
		expect(JSON.parse(JSON.stringify(binding.operation.descriptor))).toEqual(binding.operation.descriptor);
		expect("bind" in binding.operation.descriptor).toBe(false);
		expect("safeParse" in binding.operation.descriptor.inputSchema).toBe(false);

		const manifest = registryWith(binding).manifest();
		expect(manifest.operations).toEqual([{ ...binding.operation.descriptor, available: true, approvalRequired: false }]);
	});

	it("rejects invalid operation metadata before registration", () => {
		expect(() => defineVehicleOperation({ ...ECHO_OPTIONS, name: "" })).toThrow("operation name");
		expect(() =>
			defineVehicleOperation({
				...ECHO_OPTIONS,
				limits: { ...ECHO_OPTIONS.limits, defaultTimeoutMs: 6_000 },
			}),
		).toThrow("defaultTimeoutMs");
	});
});

describe("VehicleRegistry", () => {
	it("keeps the existing explicit-version identity path unchanged", () => {
		const registry = new VehicleRegistry({ name: "test", version: "1.2.3", description: "Test." });
		expect(registry.manifest()).toMatchObject({ name: "test", version: "1.2.3", description: "Test." });
	});

	it("derives its manifest version from the caller's package.json", () => {
		const packageJsonUrl = new URL("../package.json", import.meta.url);
		const packageJson = JSON.parse(readFileSync(packageJsonUrl, "utf8")) as { version: string };
		const registry = new VehicleRegistry({ name: "vehicle-server", packageJsonUrl, description: "Test." });
		expect(registry.manifest().version).toBe(packageJson.version);
	});

	it("returns a validated result from the operation's sole owner", async () => {
		const registry = new VehicleRegistry({ name: "test", version: "1", description: "Test." });
		registry.register("echo-provider", echoBinding());

		await expect(registry.invoke("test.echo", 1, { value: "hello" }, { permissions: ["test:echo"] })).resolves.toEqual({ echoed: "hello" });
		expect(registry.ownerOf("test.echo", 1)).toBe("echo-provider");
	});

	it("rejects duplicate ownership for the same name and version", () => {
		const registry = new VehicleRegistry({ name: "test", version: "1", description: "Test." });
		registry.register("first", echoBinding());
		expect(() => registry.register("second", echoBinding())).toThrow("already owned by first");
	});

	it("reports every registered operation as available by default", () => {
		const manifest = registryWith().manifest();
		expect(manifest.operations[0]?.available).toBe(true);
		expect(manifest.operations[0]?.unavailableReason).toBeUndefined();
	});

	it("setAvailability(false) hides an operation from the manifest and refuses invocation, without unregistering it", async () => {
		const registry = new VehicleRegistry({ name: "test", version: "1", description: "Test." });
		registry.register("echo-provider", echoBinding());

		registry.setAvailability("test.echo", 1, false, "credential not configured");

		const manifest = registry.manifest();
		expect(manifest.operations[0]).toMatchObject({ available: false, unavailableReason: "credential not configured" });
		expect(registry.ownerOf("test.echo", 1)).toBe("echo-provider"); // still registered, just hidden

		await expect(registry.invoke("test.echo", 1, { value: "hello" }, { permissions: ["test:echo"] })).rejects.toMatchObject({
			code: "operation-unavailable",
			category: "unavailable",
			retryable: true,
		});

		registry.setAvailability("test.echo", 1, true);
		const manifestAgain = registry.manifest();
		expect(manifestAgain.operations[0]).toMatchObject({ available: true });
		expect(manifestAgain.operations[0]?.unavailableReason).toBeUndefined();
		await expect(registry.invoke("test.echo", 1, { value: "hello" }, { permissions: ["test:echo"] })).resolves.toEqual({ echoed: "hello" });
	});

	it("setAvailability throws for an operation that was never registered", () => {
		const registry = new VehicleRegistry({ name: "test", version: "1", description: "Test." });
		expect(() => registry.setAvailability("nope", 1, false)).toThrow("unregistered");
	});

	it("validates both input and output with bounded structured details", async () => {
		const registry = registryWith(echoBinding(() => async () => ({ echoed: 42 }) as never));

		await expect(registry.invoke("test.echo", 1, { value: 1 }, { permissions: ["test:echo"] })).rejects.toMatchObject({
			code: "invalid-input",
			category: "validation",
			retryable: false,
			details: { issues: [{ path: [], message: "invalid object" }] },
		});
		await expect(registry.invoke("test.echo", 1, { value: "hello" }, { permissions: ["test:echo"] })).rejects.toMatchObject({
			code: "invalid-output",
			category: "internal",
			retryable: false,
		});
	});

	it("enforces declared request and response byte bounds", async () => {
		await expect(registryWith().invoke("test.echo", 1, { value: "x".repeat(2_000) }, { permissions: ["test:echo"] })).rejects.toMatchObject(
			{ code: "request-too-large", category: "capacity" },
		);

		const oversizedOutput = echoBinding(() => async () => ({ echoed: "x".repeat(2_000) }));
		await expect(
			registryWith(oversizedOutput).invoke("test.echo", 1, { value: "small" }, { permissions: ["test:echo"] }),
		).rejects.toMatchObject({ code: "response-too-large", category: "capacity" });
	});

	it("requires an idempotency key for keyed mutations", async () => {
		const operation = defineVehicleOperation({
			...ECHO_OPTIONS,
			name: "test.keyed-echo",
			effect: "external-write",
			requiresApproval: false,
			idempotency: { mode: "keyed", retentionMs: 60_000 },
		});
		const registry = new VehicleRegistry({ name: "test", version: "1", description: "Test." });
		registry.register(
			"keyed-provider",
			bindVehicleOperation(operation, () => async ({ input }) => ({ echoed: input.value })),
		);

		await expect(registry.invoke("test.keyed-echo", 1, { value: "hello" }, { permissions: ["test:echo"] })).rejects.toMatchObject({
			code: "idempotency-key-required",
			category: "validation",
		});
		await expect(
			registry.invoke(
				"test.keyed-echo",
				1,
				{ value: "hello" },
				{
					permissions: ["test:echo"],
					idempotencyKey: "request-1",
				},
			),
		).resolves.toEqual({ echoed: "hello" });
	});

	it("fails closed when required permissions are absent", async () => {
		await expect(registryWith().invoke("test.echo", 1, { value: "hello" })).rejects.toMatchObject({
			code: "permission-denied",
			category: "authorization",
			retryable: false,
		});
	});

	it("propagates cancellation and bounded deadlines to the handler", async () => {
		let receivedSignal: AbortSignal | undefined;
		const binding = bindVehicleOperation(Echo, () => async ({ signal }) => {
			receivedSignal = signal;
			return new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
		});
		const registry = registryWith(binding);
		const controller = new AbortController();
		const invocation = registry.invoke(
			"test.echo",
			1,
			{ value: "hello" },
			{
				permissions: ["test:echo"],
				signal: controller.signal,
			},
		);
		controller.abort(new Error("stop"));

		await expect(invocation).rejects.toMatchObject({ code: "cancelled" });
		expect(receivedSignal?.aborted).toBe(true);
		await expect(
			registry.invoke(
				"test.echo",
				1,
				{ value: "late" },
				{
					permissions: ["test:echo"],
					deadline: Date.now() - 1,
				},
			),
		).rejects.toMatchObject({ code: "deadline-exceeded" });
	});

	it("names the operation and its configured timeout when a handler genuinely runs past the deadline, not a generic message", async () => {
		const slowOperation = defineVehicleOperation({
			...ECHO_OPTIONS,
			name: "test.slow-echo",
			limits: { ...ECHO_OPTIONS.limits, defaultTimeoutMs: 20 },
		});
		const registry = new VehicleRegistry({ name: "test", version: "1", description: "Test." });
		registry.register(
			"echo-provider",
			bindVehicleOperation(slowOperation, () => () => new Promise(() => {})), // never resolves
		);
		const rejection = await registry
			.invoke("test.slow-echo", 1, { value: "hello" }, { permissions: ["test:echo"] })
			.catch((error) => error);
		expect(rejection).toMatchObject({ code: "deadline-exceeded" });
		expect((rejection as Error).message).toContain("test.slow-echo");
		expect((rejection as Error).message).toContain("20ms");
	});

	it("reports missing operation versions as structured failures", async () => {
		await expect(registryWith().invoke("test.echo", 2, { value: "hello" }, { permissions: ["test:echo"] })).rejects.toBeInstanceOf(
			VehicleError,
		);
		await expect(registryWith().invoke("test.echo", 2, { value: "hello" }, { permissions: ["test:echo"] })).rejects.toMatchObject({
			code: "not-found",
			category: "not_found",
		});
	});

	it("reports progress before returning the final validated result", async () => {
		const progress: unknown[] = [];
		const binding = bindVehicleOperation(Echo, () => async ({ input, reportProgress }) => {
			reportProgress({ echoed: "partial" });
			return { echoed: input.value };
		});
		const result = await registryWith(binding).invoke(
			"test.echo",
			1,
			{ value: "final" },
			{
				permissions: ["test:echo"],
				onProgress: (event) => progress.push(event),
			},
		);

		expect(progress).toEqual([{ echoed: "partial" }]);
		expect(result).toEqual({ echoed: "final" });
	});

	it("gives execution policy validated input and allows an approved effective input", async () => {
		const observed: string[] = [];
		const policy: VehicleExecutionPolicy = {
			async execute(request, invoke) {
				observed.push(`${request.operation.name}@${request.operation.version}:${request.operationId}:${request.correlationId}`);
				return invoke({ value: "approved" });
			},
		};
		const result = await registryWith(echoBinding(), policy).invoke(
			"test.echo",
			1,
			{ value: "requested" },
			{
				permissions: ["test:echo"],
				operationId: "operation-1",
				correlationId: "turn-1",
			},
		);

		expect(result).toEqual({ echoed: "approved" });
		expect(observed).toEqual(["test.echo@1:operation-1:turn-1"]);
	});

	it("threads callerSessionId/callerProjectRoot through to both the handler's own context and the execution policy's request, same as correlationId", async () => {
		const observedContext: unknown[] = [];
		const binding = echoBinding(() => async (context) => {
			observedContext.push({
				callerSessionId: (context as { callerSessionId?: string }).callerSessionId,
				callerProjectRoot: (context as { callerProjectRoot?: string }).callerProjectRoot,
			});
			return { echoed: context.input.value };
		});
		const observedPolicyRequest: unknown[] = [];
		const policy: VehicleExecutionPolicy = {
			async execute(request, invoke) {
				observedPolicyRequest.push({ callerSessionId: request.callerSessionId, callerProjectRoot: request.callerProjectRoot });
				return invoke(request.input);
			},
		};
		await registryWith(binding, policy).invoke(
			"test.echo",
			1,
			{ value: "x" },
			{ permissions: ["test:echo"], callerSessionId: "session-42", callerProjectRoot: "/home/x/pipes" },
		);

		expect(observedContext).toEqual([{ callerSessionId: "session-42", callerProjectRoot: "/home/x/pipes" }]);
		expect(observedPolicyRequest).toEqual([{ callerSessionId: "session-42", callerProjectRoot: "/home/x/pipes" }]);
	});

	it("leaves callerSessionId/callerProjectRoot undefined when the caller never supplies them", async () => {
		const observed: unknown[] = [];
		const binding = echoBinding(() => async (context) => {
			observed.push((context as { callerSessionId?: string }).callerSessionId);
			return { echoed: context.input.value };
		});
		await registryWith(binding).invoke("test.echo", 1, { value: "x" }, { permissions: ["test:echo"] });
		expect(observed).toEqual([undefined]);
	});

	it("normalizes unexpected policy failures", async () => {
		const policy: VehicleExecutionPolicy = {
			execute() {
				return Promise.reject(new Error("policy internals"));
			},
		};
		await expect(
			registryWith(echoBinding(), policy).invoke("test.echo", 1, { value: "hello" }, { permissions: ["test:echo"] }),
		).rejects.toMatchObject({ code: "policy-failed", message: "test.echo@1 execution policy failed" });
	});

	it("normalizes handler failures without exposing their message in the wire-safe failure", async () => {
		const failure = new Error("credential=secret");
		const registry = registryWith(
			echoBinding(() => async () => {
				throw failure;
			}),
		);
		try {
			await registry.invoke("test.echo", 1, { value: "hello" }, { permissions: ["test:echo"] });
			throw new Error("expected invocation to fail");
		} catch (error) {
			expect(error).toBeInstanceOf(VehicleError);
			expect(error).toMatchObject({ code: "handler-failed", message: "test.echo@1 handler failed", cause: failure });
			expect((error as VehicleError).toFailure().message).not.toContain("secret");
			expect((error as VehicleError).toFailure().causeMessage).toBeUndefined();
		}
	});

	it("preserves a mapped VehicleError created by another installed vehicle-core copy", async () => {
		const foreign = Object.assign(new Error("backend missing"), { code: "operation-rejected", category: "not_found" });
		Object.defineProperty(foreign, Symbol.for("@danypops/vehicle-core/VehicleError"), { value: true });
		const registry = registryWith(
			echoBinding(() => async () => {
				throw foreign;
			}),
		);
		await expect(registry.invoke("test.echo", 1, { value: "hello" }, { permissions: ["test:echo"] })).rejects.toBe(foreign);
	});

	it("once setExposeHandlerFailureDetails(true) is called, an unexpected handler failure's real message reaches the wire-safe failure", async () => {
		const registry = registryWith(
			echoBinding(() => async () => {
				throw new Error("column 'title' is required");
			}),
		);
		registry.setExposeHandlerFailureDetails(true);
		try {
			await registry.invoke("test.echo", 1, { value: "hello" }, { permissions: ["test:echo"] });
			throw new Error("expected invocation to fail");
		} catch (error) {
			const failure = (error as VehicleError).toFailure();
			expect(failure.message).toBe("test.echo@1 handler failed: column 'title' is required");
			expect(failure.causeMessage).toBe("column 'title' is required");
		}
	});

	it("exposeHandlerFailureDetails also applies to unexpected execution-policy failures", async () => {
		const policy: VehicleExecutionPolicy = {
			execute() {
				return Promise.reject(new Error("policy internals"));
			},
		};
		const registry = registryWith(echoBinding(), policy);
		registry.setExposeHandlerFailureDetails(true);
		await expect(registry.invoke("test.echo", 1, { value: "hello" }, { permissions: ["test:echo"] })).rejects.toMatchObject({
			code: "policy-failed",
			message: "test.echo@1 execution policy failed: policy internals",
		});
	});

	function observingMiddleware(id: string, order: string[], rewriteTo?: string): VehicleExecutionMiddleware {
		return {
			id,
			async intercept(request, next) {
				order.push(`${id}:${(request.input as { value: string }).value}`);
				return next(rewriteTo ? { value: rewriteTo } : request.input);
			},
		};
	}

	describe("useExecutionMiddleware", () => {
		it("runs registered middlewares in registration order, outermost first", async () => {
			const order: string[] = [];
			const registry = registryWith();
			registry.useExecutionMiddleware(observingMiddleware("first", order));
			registry.useExecutionMiddleware(observingMiddleware("second", order));
			const result = await registry.invoke("test.echo", 1, { value: "go" }, { permissions: ["test:echo"] });

			expect(order).toEqual(["first:go", "second:go"]);
			expect(result).toEqual({ echoed: "go" });
		});

		it("a middleware's rewritten input reaches a later middleware and the core handler", async () => {
			const order: string[] = [];
			const registry = registryWith();
			registry.useExecutionMiddleware(observingMiddleware("first", order, "rewritten"));
			registry.useExecutionMiddleware(observingMiddleware("second", order));
			const result = await registry.invoke("test.echo", 1, { value: "go" }, { permissions: ["test:echo"] });

			expect(order).toEqual(["first:go", "second:rewritten"]);
			expect(result).toEqual({ echoed: "rewritten" });
		});

		it("a middleware that throws denies the call -- never a silent passthrough", async () => {
			const registry = registryWith();
			registry.useExecutionMiddleware({
				id: "denier",
				intercept() {
					return Promise.reject(new Error("denied by policy"));
				},
			});
			await expect(registry.invoke("test.echo", 1, { value: "go" }, { permissions: ["test:echo"] })).rejects.toMatchObject({
				code: "policy-failed",
				message: "test.echo@1 execution policy failed",
			});
		});

		it("coexists with the legacy single-slot policy -- middlewares wrap outside it", async () => {
			const order: string[] = [];
			const legacyPolicy: VehicleExecutionPolicy = {
				async execute(request, invoke) {
					order.push(`legacy:${(request.input as { value: string }).value}`);
					return invoke(request.input);
				},
			};
			const registry = registryWith(echoBinding(), legacyPolicy);
			registry.useExecutionMiddleware(observingMiddleware("outer", order, "from-middleware"));
			const result = await registry.invoke("test.echo", 1, { value: "go" }, { permissions: ["test:echo"] });

			expect(order).toEqual(["outer:go", "legacy:from-middleware"]);
			expect(result).toEqual({ echoed: "from-middleware" });
		});

		it("rejects a duplicate middleware id", () => {
			const registry = registryWith();
			const middleware = observingMiddleware("dup", []);
			registry.useExecutionMiddleware(middleware);
			expect(() => registry.useExecutionMiddleware(middleware)).toThrow('Vehicle execution middleware "dup" is already registered');
		});

		it("is bounded -- refuses beyond the maximum registered middlewares", () => {
			const registry = registryWith();
			for (let i = 0; i < 16; i++) registry.useExecutionMiddleware(observingMiddleware(`mw-${i}`, []));
			expect(() => registry.useExecutionMiddleware(observingMiddleware("mw-16", []))).toThrow(VehicleError);
		});

		it("the Approval Gate still behaves correctly alongside a registered middleware", async () => {
			const order: string[] = [];
			const registry = destructiveEchoRegistry();
			registry.configureApprovals({ requireApprovalForEffects: ["destructive"] });
			// Scoped to the gated operation itself -- vehicle.approval.resolve's own invoke() also
			// passes through this same middleware (a real cross-cutting concern applies to every
			// operation), which isn't what this test is about.
			registry.useExecutionMiddleware({
				id: "audit",
				async intercept(request, next) {
					if (request.operation.name === "test.destructive-echo") order.push(`audit:${(request.input as { value: string }).value}`);
					return next(request.input);
				},
			});

			const requestId = await requestApprovalGate(registry);
			const resolution = (await registry.invoke("vehicle.approval.resolve", 1, { requestId, decision: "granted" }, {
				permissions: ["vehicle:approvals:resolve"],
			})) as { capability: string };
			const result = await registry.invoke(
				"test.destructive-echo",
				1,
				{ value: "go" },
				{ permissions: ["test:echo"], approvalCapability: resolution.capability },
			);

			expect(result).toEqual({ echoed: "go" });
			expect(order).toEqual(["audit:go"]);
		});
	});

	it("binds state once per registry so separate local providers are isolated", async () => {
		const stateful = echoBinding(() => {
			let calls = 0;
			return async () => ({ echoed: String(++calls) });
		});
		const first = registryWith(stateful);
		const second = registryWith(stateful);

		expect(await first.invoke("test.echo", 1, { value: "x" }, { permissions: ["test:echo"] })).toEqual({ echoed: "1" });
		expect(await first.invoke("test.echo", 1, { value: "x" }, { permissions: ["test:echo"] })).toEqual({ echoed: "2" });
		expect(await second.invoke("test.echo", 1, { value: "x" }, { permissions: ["test:echo"] })).toEqual({ echoed: "1" });
	});
});

const Announced = defineVehicleEvent({
	name: "test.announced",
	version: 1,
	description: "A test event.",
	payload: outputSchema,
	maxPayloadBytes: 1_024,
});

describe("VehicleRegistry events", () => {
	it("registerEvent() rejects a second owner for the same name@version", () => {
		const registry = new VehicleRegistry({ name: "test", version: "1", description: "Test." });
		registry.registerEvent("first-owner", Announced);
		expect(() => registry.registerEvent("second-owner", Announced)).toThrow(/already owned by first-owner/);
	});

	it("subscribeLocal() throws not-found for an event nobody declared", () => {
		const registry = new VehicleRegistry({ name: "test", version: "1", description: "Test." });
		expect(() => registry.subscribeLocal("nope", 1, () => {})).toThrow(/No Vehicle event is registered/);
	});

	it("subscribeLocal() enforces a bounded listener count per event", () => {
		const registry = new VehicleRegistry({ name: "test", version: "1", description: "Test." });
		registry.registerEvent("owner", Announced);
		const unsubscribes: (() => void)[] = [];
		for (let i = 0; i < 64; i++) unsubscribes.push(registry.subscribeLocal("test.announced", 1, () => {}));
		expect(() => registry.subscribeLocal("test.announced", 1, () => {})).toThrow(/maximum of 64 local listeners/);
		unsubscribes[0]!();
		expect(() => registry.subscribeLocal("test.announced", 1, () => {})).not.toThrow();
	});

	it("subscribeAll() observes every declared event's emit(), regardless of name", () => {
		const registry = new VehicleRegistry({ name: "test", version: "1", description: "Test." });
		registry.registerEvent("owner", Announced);
		const seen: { name: string; version: number; payload: unknown }[] = [];
		registry.subscribeAll((name, version, payload) => seen.push({ name, version, payload }));
		registry.emit("test.announced", 1, { echoed: "hi" });
		expect(seen).toEqual([{ name: "test.announced", version: 1, payload: { echoed: "hi" } }]);
	});

	it("bridgeVehicleEventsToPushChannel() forwards emit() onto publish() under the shared topic convention", () => {
		const registry = new VehicleRegistry({ name: "test", version: "1", description: "Test." });
		registry.registerEvent("owner", Announced);
		const published: { topic: string; payload: unknown }[] = [];
		const unsubscribe = bridgeVehicleEventsToPushChannel(registry, {
			publish: (topic, payload) => published.push({ topic, payload }),
		});
		registry.emit("test.announced", 1, { echoed: "hi" });
		expect(published).toEqual([{ topic: "vehicle-event:test.announced@1", payload: { echoed: "hi" } }]);
		unsubscribe();
		registry.emit("test.announced", 1, { echoed: "after unsubscribe" });
		expect(published).toHaveLength(1);
	});
});

describe("VehicleRegistry approval gate", () => {
	it("fails closed when a risky operation has no approval decision", async () => {
		const registry = destructiveEchoRegistry();
		await expect(registry.invoke("test.destructive-echo", 1, { value: "go" }, { permissions: ["test:echo"] })).rejects.toMatchObject({
			code: "approval-policy-unconfigured",
			category: "authorization",
			details: { operation: "test.destructive-echo@1", effect: "destructive" },
		});
		expect(registry.manifest()).toMatchObject({
			approvalPolicy: {
				status: "unconfigured",
				requireApprovalForEffects: ["destructive", "open-world", "external-write"],
				unconfiguredRiskyOperations: ["test.destructive-echo@1"],
			},
			events: [],
		});
	});

	it("allows an explicit deployment-wide approval opt-out", async () => {
		const registry = destructiveEchoRegistry();
		registry.configureApprovals({ enabled: false });

		await expect(registry.invoke("test.destructive-echo", 1, { value: "go" }, { permissions: ["test:echo"] })).resolves.toEqual({
			echoed: "go",
		});
		expect(registry.manifest().approvalPolicy).toMatchObject({ status: "disabled", unconfiguredRiskyOperations: [] });
	});

	it("configureApprovals() twice throws", () => {
		const registry = destructiveEchoRegistry();
		registry.configureApprovals();
		expect(() => registry.configureApprovals()).toThrow("already configured");
	});

	it("gates the default destructive/open-world effects, emits approval.requested durably, and rejects an unapproved retry", async () => {
		const registry = destructiveEchoRegistry();
		registry.configureApprovals();
		const requested: unknown[] = [];
		registry.subscribeLocal("vehicle.approval.requested", 1, (payload) => requested.push(payload));

		await expect(registry.invoke("test.destructive-echo", 1, { value: "go" }, { permissions: ["test:echo"] })).rejects.toMatchObject({
			code: "approval-required",
			category: "authorization",
			retryable: true,
			details: { requestId: expect.any(String) },
		});
		expect(requested).toEqual([
			expect.objectContaining({ operationName: "test.destructive-echo", operationVersion: 1, effect: "destructive" }),
		]);
	});

	it("grants a real capability through vehicle.approval.resolve, and the retried invoke() succeeds", async () => {
		const registry = destructiveEchoRegistry();
		registry.configureApprovals();
		const requestId = await requestApprovalGate(registry);

		const resolved = (await registry.invoke(
			"vehicle.approval.resolve",
			1,
			{ requestId, decision: "granted" },
			{ permissions: ["vehicle:approvals:resolve"] },
		)) as { capability?: string };
		expect(typeof resolved.capability).toBe("string");

		await expect(
			registry.invoke("test.destructive-echo", 1, { value: "go" }, { permissions: ["test:echo"], approvalCapability: resolved.capability }),
		).resolves.toEqual({ echoed: "go" });
	});

	it("persists an optional human approval comment on the resolved event", async () => {
		const registry = destructiveEchoRegistry();
		registry.configureApprovals();
		const resolvedEvents: unknown[] = [];
		registry.subscribeLocal("vehicle.approval.resolved", 1, (payload) => resolvedEvents.push(payload));
		const requestId = await requestApprovalGate(registry);

		await registry.invoke(
			"vehicle.approval.resolve",
			1,
			{ requestId, decision: "denied", comment: "Input targets the wrong environment." },
			{ permissions: ["vehicle:approvals:resolve"] },
		);

		expect(resolvedEvents).toEqual([
			expect.objectContaining({ requestId, decision: "denied", comment: "Input targets the wrong environment." }),
		]);
	});

	it("a denied decision mints no capability, and the request cannot be resolved twice", async () => {
		const registry = destructiveEchoRegistry();
		registry.configureApprovals();
		const requestId = await requestApprovalGate(registry);

		const denied = (await registry.invoke(
			"vehicle.approval.resolve",
			1,
			{ requestId, decision: "denied" },
			{ permissions: ["vehicle:approvals:resolve"] },
		)) as {
			capability?: string;
		};
		expect(denied.capability).toBeUndefined();

		await expect(
			registry.invoke("vehicle.approval.resolve", 1, { requestId, decision: "granted" }, { permissions: ["vehicle:approvals:resolve"] }),
		).rejects.toMatchObject({ code: "not-found" });
	});

	it("vehicle.approval.status reports pending while unresolved, then resolved with the decision and comment once answered -- even for a caller that never itself called resolve", async () => {
		const registry = destructiveEchoRegistry();
		registry.configureApprovals();
		const requestId = await requestApprovalGate(registry);

		await expect(registry.invoke("vehicle.approval.status", 1, { requestId }, {})).resolves.toEqual({ requestId, status: "pending" });

		await registry.invoke(
			"vehicle.approval.resolve",
			1,
			{ requestId, decision: "denied", decidedBy: "alice", comment: "wrong environment" },
			{ permissions: ["vehicle:approvals:resolve"] },
		);

		// A totally independent caller (no special permission, never itself invoked resolve) can
		// still learn the outcome -- the whole point: the human's decision and comment must not be
		// stranded on whichever specific call happened to trigger the original request.
		await expect(registry.invoke("vehicle.approval.status", 1, { requestId }, {})).resolves.toEqual({
			requestId,
			status: "resolved",
			outcome: expect.objectContaining({ requestId, decision: "denied", decidedBy: "alice", comment: "wrong environment" }),
		});
	});

	it("vehicle.approval.status reports unknown for a requestId that never existed", async () => {
		const registry = destructiveEchoRegistry();
		registry.configureApprovals();

		await expect(registry.invoke("vehicle.approval.status", 1, { requestId: "never-issued" }, {})).resolves.toEqual({
			requestId: "never-issued",
			status: "unknown",
		});
	});

	it("vehicle.approval.status is not projected as vehicle.approval.resolve is -- it stays in the manifest since observing an outcome can never let a caller grant its own request", () => {
		const registry = destructiveEchoRegistry();
		registry.configureApprovals();

		expect(registry.manifest().operations.map((op) => op.name)).toContain("vehicle.approval.status");
	});

	it("rejects an arbitrary non-empty string as a capability instead of rubber-stamping it", async () => {
		const registry = destructiveEchoRegistry();
		registry.configureApprovals();

		await expect(
			registry.invoke("test.destructive-echo", 1, { value: "go" }, { permissions: ["test:echo"], approvalCapability: "signed-capability" }),
		).rejects.toMatchObject({ code: "approval-capability-invalid", category: "authorization", retryable: false });
	});

	it("rejects a capability minted for a different input than the one presented", async () => {
		const registry = destructiveEchoRegistry();
		registry.configureApprovals();
		const requestId = await requestApprovalGate(registry, { value: "original" });
		const { capability } = (await registry.invoke(
			"vehicle.approval.resolve",
			1,
			{ requestId, decision: "granted" },
			{ permissions: ["vehicle:approvals:resolve"] },
		)) as { capability?: string };

		await expect(
			registry.invoke("test.destructive-echo", 1, { value: "tampered" }, { permissions: ["test:echo"], approvalCapability: capability }),
		).rejects.toMatchObject({ code: "approval-capability-invalid" });
	});

	it("a granted capability is single-use -- a second invoke() with the same capability is rejected", async () => {
		const registry = destructiveEchoRegistry();
		registry.configureApprovals();
		const requestId = await requestApprovalGate(registry);
		const { capability } = (await registry.invoke(
			"vehicle.approval.resolve",
			1,
			{ requestId, decision: "granted" },
			{ permissions: ["vehicle:approvals:resolve"] },
		)) as { capability?: string };

		await expect(
			registry.invoke("test.destructive-echo", 1, { value: "go" }, { permissions: ["test:echo"], approvalCapability: capability }),
		).resolves.toEqual({ echoed: "go" });
		await expect(
			registry.invoke("test.destructive-echo", 1, { value: "go" }, { permissions: ["test:echo"], approvalCapability: capability }),
		).rejects.toMatchObject({ code: "approval-capability-invalid" });
	});

	it("a request that outlives its timeout expires -- the retried invoke() gets a fresh requestId, not the stale one", async () => {
		const registry = destructiveEchoRegistry();
		registry.configureApprovals({ timeoutMs: 1 });
		const requestId = await requestApprovalGate(registry);
		await new Promise((resolve) => setTimeout(resolve, 10));

		await expect(
			registry.invoke("vehicle.approval.resolve", 1, { requestId, decision: "granted" }, { permissions: ["vehicle:approvals:resolve"] }),
		).rejects.toMatchObject({ code: "not-found" });
	});

	it("gates external writes by default while leaving read and local-write operations alone", async () => {
		const registry = new VehicleRegistry({ name: "test", version: "1", description: "Test." });
		const writeOp = defineVehicleOperation({ ...ECHO_OPTIONS, name: "test.write-echo", effect: "external-write" });
		registry.register(
			"echo-provider",
			bindVehicleOperation(writeOp, () => async ({ input }) => ({ echoed: input.value })),
		);
		registry.configureApprovals();

		await expect(registry.invoke("test.write-echo", 1, { value: "go" }, { permissions: ["test:echo"] })).rejects.toMatchObject({
			code: "approval-required",
		});

		const readOnly = new VehicleRegistry({ name: "test", version: "1", description: "Test." });
		readOnly.register("echo-provider", echoBinding());
		readOnly.configureApprovals({ requireApprovalForEffects: ["external-write"] });
		await expect(readOnly.invoke("test.echo", 1, { value: "go" }, { permissions: ["test:echo"] })).resolves.toEqual({ echoed: "go" });
	});

	it("an operation's own requiresApproval overrides the effect-derived default -- gated even though its effect isn't in the configured set", async () => {
		const registry = new VehicleRegistry({ name: "test", version: "1", description: "Test." });
		const op = defineVehicleOperation({ ...ECHO_OPTIONS, name: "test.override-gated", effect: "external-write", requiresApproval: true });
		registry.register(
			"echo-provider",
			bindVehicleOperation(op, () => async ({ input }) => ({ echoed: input.value })),
		);
		// external-write is deliberately left out of requireApprovalForEffects -- only the
		// operation's own override should gate it.
		registry.configureApprovals({ requireApprovalForEffects: ["destructive"] });

		await expect(registry.invoke("test.override-gated", 1, { value: "go" }, { permissions: ["test:echo"] })).rejects.toMatchObject({
			code: "approval-required",
		});
	});

	it("an operation's own requiresApproval: false is an explicit narrow opt-out", async () => {
		const registry = new VehicleRegistry({ name: "test", version: "1", description: "Test." });
		const op = defineVehicleOperation({ ...ECHO_OPTIONS, name: "test.override-exempt", effect: "destructive", requiresApproval: false });
		registry.register(
			"echo-provider",
			bindVehicleOperation(op, () => async ({ input }) => ({ echoed: input.value })),
		);

		await expect(registry.invoke("test.override-exempt", 1, { value: "go" }, { permissions: ["test:echo"] })).resolves.toEqual({
			echoed: "go",
		});
		expect(registry.manifest()).toMatchObject({
			approvalPolicy: { status: "unconfigured", unconfiguredRiskyOperations: [] },
			operations: [expect.objectContaining({ name: "test.override-exempt", approvalRequired: false })],
		});
	});

	it("manifest().operations reports the live, resolved approvalRequired per operation", () => {
		const registry = new VehicleRegistry({ name: "test", version: "1", description: "Test." });
		registry.register("echo-provider", echoBinding());
		const destructiveOp = defineVehicleOperation({ ...ECHO_OPTIONS, name: "test.destructive-echo", effect: "destructive" });
		registry.register(
			"echo-provider",
			bindVehicleOperation(destructiveOp, () => async ({ input }) => ({ echoed: input.value })),
		);

		expect(registry.manifest().operations.map((op) => [op.name, op.approvalRequired])).toEqual([
			["test.echo", false],
			["test.destructive-echo", true],
		]);
		expect(registry.manifest().approvalPolicy).toMatchObject({
			status: "unconfigured",
			unconfiguredRiskyOperations: ["test.destructive-echo@1"],
		});

		registry.configureApprovals();
		expect(
			registry
				.manifest()
				.operations.filter((op) => op.name !== "vehicle.approval.resolve" && op.name !== "vehicle.approval.status")
				.map((op) => [op.name, op.approvalRequired]),
		).toEqual([
			["test.echo", false],
			["test.destructive-echo", true],
		]);
	});

	it("updateApprovalPolicy throws before configureApprovals() has ever been called", () => {
		const registry = destructiveEchoRegistry();
		expect(() => registry.updateApprovalPolicy({ enabled: false })).toThrow("call configureApprovals() first");
	});

	it("updateApprovalPolicy({ enabled: false }) turns the gate off live, no restart, and updateApprovalPolicy({ enabled: true }) turns it back on", async () => {
		const registry = destructiveEchoRegistry();
		registry.configureApprovals();
		await expect(registry.invoke("test.destructive-echo", 1, { value: "go" }, { permissions: ["test:echo"] })).rejects.toMatchObject({
			code: "approval-required",
		});

		registry.updateApprovalPolicy({ enabled: false });
		await expect(registry.invoke("test.destructive-echo", 1, { value: "go" }, { permissions: ["test:echo"] })).resolves.toEqual({
			echoed: "go",
		});
		expect(registry.manifest().operations.find((op) => op.name === "test.destructive-echo")?.approvalRequired).toBe(false);

		registry.updateApprovalPolicy({ enabled: true });
		await expect(registry.invoke("test.destructive-echo", 1, { value: "go" }, { permissions: ["test:echo"] })).rejects.toMatchObject({
			code: "approval-required",
		});
	});

	it("updateApprovalPolicy can also swap requireApprovalForEffects live, independent of enabled", async () => {
		const registry = destructiveEchoRegistry();
		registry.configureApprovals({ requireApprovalForEffects: ["open-world"] });
		await expect(registry.invoke("test.destructive-echo", 1, { value: "go" }, { permissions: ["test:echo"] })).resolves.toEqual({
			echoed: "go",
		});

		registry.updateApprovalPolicy({ requireApprovalForEffects: ["destructive"] });
		await expect(registry.invoke("test.destructive-echo", 1, { value: "go" }, { permissions: ["test:echo"] })).rejects.toMatchObject({
			code: "approval-required",
		});
	});

	it("a pending approval request recorded before a live policy change still resolves normally under the old decision", async () => {
		const registry = destructiveEchoRegistry();
		registry.configureApprovals();
		const requestId = await requestApprovalGate(registry);

		// Disabling the gate entirely after the request was already recorded must not
		// retroactively invalidate it -- vehicle.approval.resolve still works.
		registry.updateApprovalPolicy({ enabled: false });

		const resolved = (await registry.invoke(
			"vehicle.approval.resolve",
			1,
			{ requestId, decision: "granted" },
			{ permissions: ["vehicle:approvals:resolve"] },
		)) as { capability?: string };
		expect(typeof resolved.capability).toBe("string");
	});
});
