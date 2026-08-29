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
import type { VehicleClient } from "@danypops/vehicle-core";

export interface VehicleConformanceMatchers {
	toEqual(expected: unknown): unknown;
	toMatchObject(expected: unknown): unknown;
	toBe(expected: unknown): unknown;
	toBeTruthy(): unknown;
	toBeUndefined(): unknown;
	toContain(expected: unknown): unknown;
	toMatch(expected: RegExp | string): unknown;
	toBeGreaterThan(expected: number): unknown;
	toBeGreaterThanOrEqual(expected: number): unknown;
	toBeLessThan(expected: number): unknown;
	toBeLessThanOrEqual(expected: number): unknown;
	readonly not: VehicleConformanceMatchers;
	readonly rejects: VehicleConformanceMatchers;
	readonly resolves: VehicleConformanceMatchers;
}

export interface VehicleConformanceRunner {
	describe(name: string, body: () => void): unknown;
	it(name: string, body: () => void | Promise<void>): unknown;
	expect(actual: unknown, message?: string): VehicleConformanceMatchers;
}
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

export function registerVehicleClientConformance(runner: VehicleConformanceRunner, fixture: VehicleConformanceFixture): void {
	const { describe, expect, it } = runner;
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

		it("negotiate() agrees on the shared protocol and rejects an incompatible range", async () => {
			const { client, cleanup } = await fixture.create();
			try {
				if (!client.negotiate) throw new Error("Vehicle client does not implement protocol negotiation");
				await expect(
					client.negotiate({ minimumVersion: 1, maximumVersion: 2, requiredCapabilities: [], optionalCapabilities: ["future"] }),
				).resolves.toEqual({ version: 1, capabilities: [] });
				await expect(
					client.negotiate({ minimumVersion: 2, maximumVersion: 3, requiredCapabilities: [], optionalCapabilities: [] }),
				).rejects.toMatchObject({ code: "protocol-version-incompatible" });
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
	/**
	 * Optional -- the discriminator values (a `format`/`kind`/`action`/... field) this provider's
	 * own presentation-details schema declares, each paired with a representative raw application
	 * payload for that value. Supplying this (together with renderDeclaredValue) enables the
	 * declared-value coverage check below, which generically catches the pi-web-spider bug class
	 * (see doc 4e9e08c1, Finding 1/4): most declared values falling through to an undifferentiated
	 * JSON.stringify dump of their own payload instead of a real projected view. Omit entirely for
	 * a subject with no such discriminator -- the check then no-ops.
	 */
	readonly declaredValueCases?: readonly ToolShellDeclaredValueCase[];
	/** Required alongside declaredValueCases: renders the expanded view for one declared value's
	 * own raw payload, through exactly the same projection+render pipeline the real handler uses. */
	renderDeclaredValue?(value: string, rawPayload: unknown, options: ToolShellRenderOptions): readonly string[];
}

export interface ToolShellDeclaredValueCase {
	/** e.g. a WebFormat value ('search'/'lean'/...), a PackageToolDetails['kind'], a tickets action name. */
	readonly value: string;
	/** The real, untransformed application output this declared value would carry. */
	readonly rawPayload: unknown;
}

export interface DeclaredValueCoverageResult {
	/** Declared values whose rendered output is NOT indistinguishable from a raw JSON.stringify dump of their own payload. */
	readonly nonRawValues: readonly string[];
	/** Declared values whose rendered output IS indistinguishable from a raw JSON.stringify dump of their own payload. */
	readonly rawValues: readonly string[];
}

function normalizeForComparison(text: string): string {
	return text.replace(/\s+/g, "");
}

/**
 * True when `renderedLines` is textually indistinguishable (ignoring ANSI styling and whitespace)
 * from `JSON.stringify(rawPayload, null, 2)` -- the exact shape pi-web-spider's `primaryLines()`
 * fell back to for every non-"markdown" format. Whitespace-insensitive so a renderer that reflows
 * the same JSON text to a narrower width still counts as "raw", matching the real bug (a Text
 * component wrapping the identical JSON.stringify output).
 */
function looksLikeRawJsonDump(renderedLines: readonly string[], rawPayload: unknown): boolean {
	let rawJson: string;
	try {
		rawJson = JSON.stringify(rawPayload, null, 2) ?? "";
	} catch {
		return false;
	}
	if (rawJson.length === 0) return false;
	const renderedText = renderedLines.join("\n").replace(ANSI_CSI_PATTERN, "");
	return normalizeForComparison(renderedText) === normalizeForComparison(rawJson);
}

/**
 * Pure, independently unit-testable core of the declared-value coverage check -- separated from
 * the bun:test `it()` wiring below so a fixture reproducing a known-bad shape (e.g.
 * pi-web-spider's own pre-fix behavior) can be asserted against directly, proving the classifier
 * itself actually detects that bug class rather than trusting the wrapping `it()` alone.
 */
export function evaluateDeclaredValueCoverage(
	cases: readonly ToolShellDeclaredValueCase[],
	renderDeclaredValue: (value: string, rawPayload: unknown, options: ToolShellRenderOptions) => readonly string[],
	options: ToolShellRenderOptions = { width: 80, expanded: true },
): DeclaredValueCoverageResult {
	const nonRawValues: string[] = [];
	const rawValues: string[] = [];
	for (const { value, rawPayload } of cases) {
		const lines = renderDeclaredValue(value, rawPayload, options);
		(looksLikeRawJsonDump(lines, rawPayload) ? rawValues : nonRawValues).push(value);
	}
	return { nonRawValues, rawValues };
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

function assertPhysicalLines(expect: VehicleConformanceRunner["expect"], lines: readonly string[], width: number): void {
	expect(lines.length).toBeGreaterThan(0);
	for (const line of lines) {
		expect(line).not.toContain("\n");
		// ANSI is forbidden in model content, but permitted in host rendering.
		const visible = line.replace(ANSI_CSI_PATTERN, "");
		expect([...visible].length).toBeLessThanOrEqual(width);
	}
}

/** Reusable provider-facing dual-channel contract matrix. */
export function registerToolShellDualChannelConformance(runner: VehicleConformanceRunner, fixture: ToolShellDualChannelFixture): void {
	const { describe, expect, it } = runner;
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
					assertPhysicalLines(expect, subject.render(snapshot, { width, expanded: false }), width);
					assertPhysicalLines(expect, subject.render(snapshot, { width, expanded: true }), width);
					assertPhysicalLines(expect, subject.render(snapshot, { width, expanded: false, partial: true }), width);
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

		it("renders most of its own declared discriminator values as more than a raw JSON dump of their own payload", async () => {
			const { subject, cleanup } = await fixture.create();
			try {
				const cases = subject.declaredValueCases;
				if (!cases || cases.length === 0) return; // opt-in: no discriminator declared, nothing to check
				if (!subject.renderDeclaredValue) {
					throw new Error("declaredValueCases supplied without a matching renderDeclaredValue implementation");
				}
				const renderDeclaredValue = subject.renderDeclaredValue.bind(subject);
				const options: ToolShellRenderOptions = { width: 80, expanded: true };
				for (const { value, rawPayload } of cases) {
					assertPhysicalLines(expect, renderDeclaredValue(value, rawPayload, options), options.width);
				}
				const { nonRawValues, rawValues } = evaluateDeclaredValueCoverage(cases, renderDeclaredValue, options);
				expect(
					nonRawValues.length,
					`declared values [${cases.map((c) => c.value).join(", ")}] mostly render as an undifferentiated JSON.stringify dump of ` +
						`their own payload -- only [${nonRawValues.join(", ") || "none"}] escape it, [${rawValues.join(", ")}] don't`,
				).toBeGreaterThanOrEqual(Math.min(2, cases.length));
			} finally {
				await cleanup();
			}
		});
	});
}
