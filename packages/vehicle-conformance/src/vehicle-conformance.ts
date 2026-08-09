/**
 * Host-neutral conformance suite: one shared set of assertions that any
 * VehicleClient implementation (LocalVehicleClient, RemoteVehicleClient,
 * and any future MCP/CLI projection) must satisfy identically. Registers
 * its own fixed set of test operations onto whatever registry the fixture
 * hands back, so the *same* operation definitions exercise every
 * implementation -- two independently hand-written test files could drift
 * apart without either one noticing; a shared suite can't.
 *
 * Deliberately built on bun:test directly (not a framework-agnostic DSL) --
 * every consumer of this package that would run it is already a Bun
 * project, and inventing a test-runner abstraction for a single-runtime
 * ecosystem would be pure ceremony.
 *
 * A fixture only supplies a fresh, isolated registry + a client bound to
 * it + cleanup -- it does not define operations or assertions itself, so
 * host-specific concerns (Alef's bus/context/display assertions, a CLI's
 * argument parsing) stay out of this module entirely, per the extraction
 * scope this generalizes.
 */
import { describe, expect, it } from "bun:test";
import type { VehicleClient } from "@danypops/vehicle-core";
import { bindVehicleOperation, defineVehicleOperation, defineVehicleSchema, VehicleError } from "@danypops/vehicle-core";
import type { VehicleRegistry } from "@danypops/vehicle-server";

const passthroughSchema = defineVehicleSchema<{ value: string }>({
	jsonSchema: { type: "object", properties: { value: { type: "string" } }, additionalProperties: false },
	safeParse(value: unknown) {
		if (typeof value === "object" && value !== null && typeof (value as { value?: unknown }).value === "string") {
			return { success: true, value: value as { value: string } };
		}
		return { success: false, issues: [{ path: ["value"], message: "value must be a string" }] };
	},
});

const outputSchema = defineVehicleSchema<{ echoed: string }>({
	jsonSchema: { type: "object", properties: { echoed: { type: "string" } }, additionalProperties: false },
	safeParse(value: unknown) {
		if (typeof value === "object" && value !== null && typeof (value as { echoed?: unknown }).echoed === "string") {
			return { success: true, value: value as { echoed: string } };
		}
		return { success: false, issues: [{ path: ["echoed"], message: "echoed must be a string" }] };
	},
});

const LIMITS = { defaultTimeoutMs: 200, maxTimeoutMs: 2_000, maxRequestBytes: 256, maxResponseBytes: 256 } as const;

const ConformanceEcho = defineVehicleOperation({
	name: "conformance.echo",
	version: 1,
	description: "Echoes its input.",
	input: passthroughSchema,
	output: outputSchema,
	permissions: ["conformance:echo"],
	effect: "read",
	idempotency: { mode: "safe" },
	limits: LIMITS,
});

const ConformanceBoom = defineVehicleOperation({
	name: "conformance.boom",
	version: 1,
	description: "Always throws a real VehicleError from its handler.",
	input: passthroughSchema,
	output: outputSchema,
	permissions: [],
	effect: "read",
	idempotency: { mode: "safe" },
	limits: LIMITS,
});

const ConformanceKeyed = defineVehicleOperation({
	name: "conformance.keyed",
	version: 1,
	description: "Requires a keyed idempotency key.",
	input: passthroughSchema,
	output: outputSchema,
	permissions: [],
	effect: "external-write",
	idempotency: { mode: "keyed", retentionMs: 60_000 },
	limits: LIMITS,
});

const ConformanceProgress = defineVehicleOperation({
	name: "conformance.progress",
	version: 1,
	description: "Reports two progress events, then resolves.",
	input: passthroughSchema,
	output: outputSchema,
	permissions: [],
	effect: "read",
	idempotency: { mode: "safe" },
	limits: LIMITS,
});

const ConformanceNever = defineVehicleOperation({
	name: "conformance.never",
	version: 1,
	description: "Never resolves on its own -- only via cancellation or deadline.",
	input: passthroughSchema,
	output: outputSchema,
	permissions: [],
	effect: "read",
	idempotency: { mode: "safe" },
	limits: LIMITS,
});

/** Genuinely slow (unlike ConformanceProgress, which resolves near-instantly) -- the streaming-progress-required check needs real elapsed time to exceed its threshold before the "did it report progress" assertion means anything. */
const SLOW_PROGRESS_DELAY_MS = 60;
const ConformanceSlowProgress = defineVehicleOperation({
	name: "conformance.slow-progress",
	version: 1,
	description:
		"Reports one progress event partway through a real delay, then resolves -- streaming: true declares it must never silently block.",
	input: passthroughSchema,
	output: outputSchema,
	permissions: [],
	effect: "read",
	idempotency: { mode: "safe" },
	streaming: true,
	limits: LIMITS,
});

/** Registers the fixed conformance operation set onto `registry`. Every fixture must call this before handing back its client. */
export function registerConformanceOperations(registry: VehicleRegistry): void {
	registry.register(
		"conformance",
		bindVehicleOperation(ConformanceEcho, () => async (context) => ({ echoed: context.input.value })),
	);
	registry.register(
		"conformance",
		bindVehicleOperation(ConformanceBoom, () => async () => {
			throw new VehicleError("conformance-boom", "conformance.boom always fails", { category: "internal" });
		}),
	);
	registry.register(
		"conformance",
		bindVehicleOperation(ConformanceKeyed, () => async (context) => ({ echoed: context.input.value })),
	);
	registry.register(
		"conformance",
		bindVehicleOperation(ConformanceProgress, () => async (context) => {
			context.reportProgress({ step: 1 });
			context.reportProgress({ step: 2 });
			return { echoed: context.input.value };
		}),
	);
	registry.register(
		"conformance",
		bindVehicleOperation(ConformanceNever, () => (context) => {
			return new Promise((_resolve, reject) => {
				context.signal.addEventListener("abort", () => reject(new Error("conformance.never aborted")), { once: true });
			});
		}),
	);
	registry.register(
		"conformance",
		bindVehicleOperation(ConformanceSlowProgress, () => async (context) => {
			context.reportProgress({ step: 1 });
			await new Promise((resolve) => setTimeout(resolve, SLOW_PROGRESS_DELAY_MS));
			return { echoed: context.input.value };
		}),
	);
}

/** Every operation this suite declares with streaming: true -- the streaming-progress-required check generates one named it() per entry, per this project's own "per-check test isolation" requirement. */
const STREAMING_OPERATIONS = [{ descriptor: ConformanceSlowProgress.descriptor, thresholdMs: SLOW_PROGRESS_DELAY_MS / 2 }] as const;

export interface VehicleConformanceFixture {
	/** Used in describe() block titles, e.g. "LocalVehicleClient" or "RemoteVehicleClient (HTTP)". */
	label: string;
	/** Builds a fresh, isolated registry (with registerConformanceOperations already applied) plus a client bound to it. Must not share state across calls -- each test gets its own. */
	create(): Promise<{ client: VehicleClient; cleanup: () => Promise<void> }>;
}

export function runVehicleClientConformance(fixture: VehicleConformanceFixture): void {
	describe(`Vehicle client conformance: ${fixture.label}`, () => {
		it("manifest() lists every registered operation with its real descriptor fields", async () => {
			const { client, cleanup } = await fixture.create();
			try {
				const manifest = await client.manifest();
				const names = manifest.operations.map((op) => `${op.name}@${op.version}`).sort();
				expect(names).toEqual([
					"conformance.boom@1",
					"conformance.echo@1",
					"conformance.keyed@1",
					"conformance.never@1",
					"conformance.progress@1",
					"conformance.slow-progress@1",
				]);
				const echo = manifest.operations.find((op) => op.name === "conformance.echo");
				expect(echo?.permissions).toEqual(["conformance:echo"]);
				expect(echo?.idempotency).toEqual({ mode: "safe" });
				// available defaults to true for every operation, and must survive
				// the wire round trip identically for a remote (HTTP/JSON) client,
				// not just the in-process local one.
				expect(manifest.operations.every((op) => op.available === true)).toBe(true);
				expect(echo?.unavailableReason).toBeUndefined();
			} finally {
				await cleanup();
			}
		});

		it("invoke() returns the real handler output on success", async () => {
			const { client, cleanup } = await fixture.create();
			try {
				const result = await client.invoke<{ echoed: string }>(
					"conformance.echo",
					1,
					{ value: "hi" },
					{ permissions: ["conformance:echo"] },
				);
				expect(result).toEqual({ echoed: "hi" });
			} finally {
				await cleanup();
			}
		});

		it("invoke() rejects invalid input before the handler ever runs", async () => {
			const { client, cleanup } = await fixture.create();
			try {
				await expect(client.invoke("conformance.echo", 1, { value: 123 }, { permissions: ["conformance:echo"] })).rejects.toMatchObject({
					code: "invalid-input",
				});
			} finally {
				await cleanup();
			}
		});

		it("invoke() enforces required permissions with permission-denied/authorization", async () => {
			const { client, cleanup } = await fixture.create();
			try {
				await expect(client.invoke("conformance.echo", 1, { value: "hi" }, {})).rejects.toMatchObject({
					code: "permission-denied",
					category: "authorization",
				});
			} finally {
				await cleanup();
			}
		});

		it("invoke() surfaces a real handler failure's own code/category/message, not a generic wrapper", async () => {
			const { client, cleanup } = await fixture.create();
			try {
				await expect(client.invoke("conformance.boom", 1, { value: "x" }, {})).rejects.toMatchObject({
					code: "conformance-boom",
					message: "conformance.boom always fails",
				});
			} finally {
				await cleanup();
			}
		});

		it("invoke() requires an idempotency key for a keyed operation", async () => {
			const { client, cleanup } = await fixture.create();
			try {
				await expect(client.invoke("conformance.keyed", 1, { value: "x" }, {})).rejects.toMatchObject({
					code: "idempotency-key-required",
				});
				const result = await client.invoke<{ echoed: string }>("conformance.keyed", 1, { value: "x" }, { idempotencyKey: "k-1" });
				expect(result).toEqual({ echoed: "x" });
			} finally {
				await cleanup();
			}
		});

		it("invoke() rejects a request exceeding its declared byte bound", async () => {
			const { client, cleanup } = await fixture.create();
			try {
				const oversized = "x".repeat(1024);
				await expect(
					client.invoke("conformance.echo", 1, { value: oversized }, { permissions: ["conformance:echo"] }),
				).rejects.toMatchObject({
					code: "request-too-large",
				});
			} finally {
				await cleanup();
			}
		});

		it("invoke() rejects an operation for a name/version pair that was never registered", async () => {
			const { client, cleanup } = await fixture.create();
			try {
				await expect(client.invoke("conformance.nonexistent", 1, {}, {})).rejects.toMatchObject({ code: "not-found" });
			} finally {
				await cleanup();
			}
		});

		it("invoke() delivers every progress event before resolving with the final result, never after", async () => {
			const { client, cleanup } = await fixture.create();
			try {
				const progress: unknown[] = [];
				let resolved = false;
				const result = await client.invoke<{ echoed: string }>(
					"conformance.progress",
					1,
					{ value: "hi" },
					{
						onProgress: (p) => {
							expect(resolved).toBe(false);
							progress.push(p);
						},
					},
				);
				resolved = true;
				expect(progress).toEqual([{ step: 1 }, { step: 2 }]);
				expect(result).toEqual({ echoed: "hi" });
			} finally {
				await cleanup();
			}
		});

		it("invoke() propagates cancellation via AbortSignal to the operation itself", async () => {
			const { client, cleanup } = await fixture.create();
			try {
				const controller = new AbortController();
				const invocation = client.invoke("conformance.never", 1, { value: "x" }, { signal: controller.signal });
				await new Promise((resolve) => setTimeout(resolve, 15));
				controller.abort();
				await expect(invocation).rejects.toBeTruthy();
			} finally {
				await cleanup();
			}
		});

		it("invoke() respects an explicit deadline that has already elapsed", async () => {
			const { client, cleanup } = await fixture.create();
			try {
				await expect(
					client.invoke("conformance.echo", 1, { value: "hi" }, { permissions: ["conformance:echo"], deadline: Date.now() - 1 }),
				).rejects.toMatchObject({
					code: "deadline-exceeded",
				});
			} finally {
				await cleanup();
			}
		});

		it("close() prevents further invoke()/manifest() calls on this client instance", async () => {
			const { client, cleanup } = await fixture.create();
			try {
				await client.close();
				await expect(client.manifest()).rejects.toBeTruthy();
			} finally {
				await cleanup();
			}
		});

		// Schema-rejection timing: an invalid-input invocation must resolve (with a
		// validation error) within a small bound, never falling through to a general
		// timeout -- catches a handler whose validation path accidentally does real
		// I/O before checking input shape. Ported from Alef's own adapter-contract.ts
		// runSchemaContract (200ms bound), a separate named check from the existing
		// "rejects invalid input" test above per this suite's own per-check isolation.
		it("invoke() rejects invalid input within a bounded time, never falling through to a general timeout", async () => {
			const { client, cleanup } = await fixture.create();
			try {
				const start = Date.now();
				await expect(client.invoke("conformance.echo", 1, { value: 123 }, { permissions: ["conformance:echo"] })).rejects.toMatchObject({
					code: "invalid-input",
				});
				const elapsed = Date.now() - start;
				expect(elapsed, `schema rejection took ${elapsed}ms -- should be immediate (<200ms)`).toBeLessThan(200);
			} finally {
				await cleanup();
			}
		});

		// Human-readable error messages: a validation failure's own .message must
		// never leak an internal validation-library-specific type name or a bare
		// stringified object -- a real bug class this ports from Alef's own
		// adapter-contract.ts (a live zod "[InputValidation]" prefix leak there).
		it("invoke() rejects invalid input with a human-readable message, never a raw validation-library leak", async () => {
			const { client, cleanup } = await fixture.create();
			try {
				const error = await client.invoke("conformance.echo", 1, { value: 123 }, { permissions: ["conformance:echo"] }).catch((e) => e);
				const message = (error as { message?: unknown }).message;
				expect(typeof message).toBe("string");
				expect(message).not.toBe("[object Object]");
				expect(message as string).not.toMatch(/ValueError|TypeBoxError|\[InputValidation\]|ZodError/);
				// Genuinely readable: names which operation failed, not just "invalid".
				expect(message as string).toContain("conformance.echo");
			} finally {
				await cleanup();
			}
		});

		// Streaming-progress-required: any operation declared streaming: true must
		// emit at least one progress event before resolving, once its real
		// execution exceeds a threshold duration -- catches a handler that
		// silently blocks the caller instead of reporting progress despite
		// declaring progress support. One named it() per discovered
		// streaming-capable operation (this suite currently declares exactly one),
		// per this project's own per-check test isolation.
		describe("streaming-progress-required (operations declared streaming: true)", () => {
			for (const { descriptor, thresholdMs } of STREAMING_OPERATIONS) {
				it(`${descriptor.name}@${descriptor.version} emits progress before resolving, once it runs past ${thresholdMs}ms`, async () => {
					const { client, cleanup } = await fixture.create();
					try {
						const progress: unknown[] = [];
						const start = Date.now();
						await client.invoke(descriptor.name, descriptor.version, { value: "hi" }, { onProgress: (p) => progress.push(p) });
						const elapsed = Date.now() - start;
						expect(
							elapsed,
							`test fixture ran in ${elapsed}ms, below its own ${thresholdMs}ms threshold -- this check can't prove anything`,
						).toBeGreaterThan(thresholdMs);
						expect(
							progress.length,
							`${descriptor.name} ran for ${elapsed}ms but emitted zero progress events -- a streaming: true operation must never silently block`,
						).toBeGreaterThan(0);
					} finally {
						await cleanup();
					}
				});
			}
		});
	});
}

export interface ToolShellConformanceSnapshot {
	readonly content: string;
	readonly details: unknown;
}

export interface ToolShellRenderOptions {
	readonly width: 40 | 80 | 120;
	readonly expanded: boolean;
	readonly partial?: boolean;
}

/**
 * Host adapter for the Tool Shell's two independent persisted channels. The
 * conformance package stays Pi-free: a Pi adapter supplies component output,
 * while a CLI or another host can supply its own renderer through this same API.
 */
export interface ToolShellDualChannelSubject {
	readonly bounds: { readonly modelContentBytes: number; readonly presentationDetailsBytes: number };
	execute(): Promise<ToolShellConformanceSnapshot>;
	render(snapshot: ToolShellConformanceSnapshot, options: ToolShellRenderOptions): readonly string[];
	replay(details: unknown, fallbackContent: string, options: ToolShellRenderOptions): readonly string[];
	renderCall(args: unknown, width: 40 | 80 | 120): readonly string[];
	invalidProjection(): Promise<unknown>;
}

export interface ToolShellDualChannelFixture {
	readonly label: string;
	create(): Promise<{ readonly subject: ToolShellDualChannelSubject; readonly cleanup: () => Promise<void> }>;
}

function utf8Length(value: string): number {
	return new TextEncoder().encode(value).byteLength;
}

// biome-ignore lint/complexity/useRegexLiterals: a constructor avoids control-character lint on the equivalent literal.
const ANSI_CSI_PATTERN = new RegExp("\\u001B\\[[0-?]*[ -/]*[@-~]", "g");

function assertPhysicalLines(lines: readonly string[], width: number): void {
	expect(lines.length).toBeGreaterThan(0);
	for (const line of lines) {
		expect(line).not.toContain("\n");
		// ANSI is forbidden in model content, but permitted in host rendering.
		const visible = line.replace(ANSI_CSI_PATTERN, "");
		expect([...visible].length).toBeLessThanOrEqual(width);
	}
}

/** Reusable provider-facing dual-channel contract matrix. */
export function runToolShellDualChannelConformance(fixture: ToolShellDualChannelFixture): void {
	describe(`Vehicle Tool Shell dual-channel conformance: ${fixture.label}`, () => {
		it("keeps model and persisted-presentation sentinels isolated under independent named bounds", async () => {
			const { subject, cleanup } = await fixture.create();
			try {
				const snapshot = await subject.execute();
				expect(snapshot.content).toContain("MODEL_ONLY");
				expect(snapshot.content).not.toContain("PRESENTATION_ONLY");
				const details = JSON.stringify(snapshot.details);
				expect(details).toContain("PRESENTATION_ONLY");
				expect(details).not.toContain("MODEL_ONLY");
				expect(details).not.toContain("RAW_SECRET");
				expect(utf8Length(snapshot.content)).toBeLessThanOrEqual(subject.bounds.modelContentBytes);
				expect(utf8Length(details)).toBeLessThanOrEqual(subject.bounds.presentationDetailsBytes);
			} finally {
				await cleanup();
			}
		});

		it("keeps model content semantic, ANSI-free, and useful when replay details reject", async () => {
			const { subject, cleanup } = await fixture.create();
			try {
				const snapshot = await subject.execute();
				expect(snapshot.content).not.toContain("\u001b[");
				for (const details of [{ schema: "unknown/v99" }, { malformed: true }, { output: { legacy: true } }, undefined]) {
					const lines = subject.replay(details, snapshot.content, { width: 80, expanded: false });
					expect(lines.join("\n")).toContain("MODEL_ONLY");
				}
			} finally {
				await cleanup();
			}
		});

		it("changes only human rendering across collapsed/expanded and 40/80/120 layouts", async () => {
			const { subject, cleanup } = await fixture.create();
			try {
				const snapshot = await subject.execute();
				const before = JSON.stringify(snapshot);
				for (const width of [40, 80, 120] as const) {
					assertPhysicalLines(subject.render(snapshot, { width, expanded: false }), width);
					assertPhysicalLines(subject.render(snapshot, { width, expanded: true }), width);
					assertPhysicalLines(subject.render(snapshot, { width, expanded: false, partial: true }), width);
				}
				expect(JSON.stringify(snapshot)).toBe(before);
			} finally {
				await cleanup();
			}
		});

		it("never echoes schema-sensitive call input and follows the documented projector exception policy", async () => {
			const { subject, cleanup } = await fixture.create();
			try {
				for (const width of [40, 80, 120] as const) {
					const call = subject.renderCall({ name: "safe-task", token: "RAW_SECRET" }, width).join("\n");
					expect(call).toContain("safe-task");
					expect(call).not.toContain("RAW_SECRET");
				}
				await expect(subject.invalidProjection()).rejects.toBeTruthy();
			} finally {
				await cleanup();
			}
		});
	});
}
