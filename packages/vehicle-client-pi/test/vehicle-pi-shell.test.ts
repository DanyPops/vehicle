import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionHarness } from "@danypops/pi-extension-harness";
import type { VehicleClient, VehicleInvocationOptions, VehicleManifest, VehicleManifestOperation } from "@danypops/vehicle-core";
import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { refreshVehicleToolAvailability, registerVehicleTools } from "../src/vehicle-pi.ts";
import { __resetVehicleShellHandleForTests, estimateToolWeightTokens } from "../src/vehicle-shell.ts";
import { __resetInProcessVehicleRegistryForTests, registerInProcessVehicle } from "../src/vehicle-shell-registry.ts";

const limits = { defaultTimeoutMs: 1_000, maxTimeoutMs: 5_000, maxRequestBytes: 1_024, maxResponseBytes: 1_024 };

function operation(name: string, overrides: Partial<VehicleManifestOperation> = {}): VehicleManifestOperation {
	return {
		name,
		version: 1,
		description: `Run ${name}.`,
		inputSchema: { type: "object", properties: { value: { type: "string" } } },
		outputSchema: { type: "object" },
		permissions: [],
		effect: "read",
		idempotency: { mode: "safe" },
		streaming: false,
		longRunning: false,
		limits,
		errors: [],
		available: true,
		...overrides,
	};
}

function manifest(operations: readonly VehicleManifestOperation[], name = "test-vehicle"): VehicleManifest {
	return { name, version: "1.0.0", description: "Test Vehicle.", operations };
}

class FakeClient implements VehicleClient {
	manifestCalls = 0;
	constructor(public value: VehicleManifest) {}
	manifest(): Promise<VehicleManifest> {
		this.manifestCalls++;
		return Promise.resolve(this.value);
	}
	async invoke<Output = unknown>(_name: string, _version: number, _input: unknown, _options?: VehicleInvocationOptions): Promise<Output> {
		return { ok: true } as Output;
	}
	close(): Promise<void> {
		return Promise.resolve();
	}
}

function fakePi(options: { existingTools?: string[] } = {}) {
	const tools: ToolDefinition[] = [];
	const harness = createExtensionHarness(() => {}, { existingTools: options.existingTools });
	const pi: ExtensionAPI = {
		...harness.api,
		registerTool(tool: ToolDefinition) {
			harness.api.registerTool(tool);
			tools.push(tool);
		},
	} as ExtensionAPI;
	return { pi, tools, harness, activeTools: () => [...harness.activeTools] };
}

async function callTool(tools: ToolDefinition[], name: string, params: unknown) {
	const tool = tools.find((t) => t.name === name);
	if (!tool) throw new Error(`tool ${name} not registered`);
	return tool.execute("call-1", params as never, undefined as never, undefined as never, { hasUI: false } as never);
}

/** Same as callTool, but with a real sessionManager/cwd -- for asserting metrics.recordClientEvent's own callerSessionId/callerProjectRoot fields thread through correctly. */
async function callToolWithContext(tools: ToolDefinition[], name: string, params: unknown, sessionId: string, cwd: string) {
	const tool = tools.find((t) => t.name === name);
	if (!tool) throw new Error(`tool ${name} not registered`);
	return tool.execute("call-1", params as never, undefined as never, undefined as never, {
		hasUI: false,
		cwd,
		sessionManager: { getSessionId: () => sessionId },
	} as never);
}

/** tools_list's own usage report runs concurrently with (never blocking) its real response -- see usage-reporting.ts's reportShellToolUsageToAllDiscovered. A test asserting it happened needs to let that background work actually land first. */
async function flushBackgroundReporting(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 10));
}

/** Records every invoke() call this client receives, alongside FakeClient's own default {ok: true} response -- for asserting the Vehicle Shell's own client-event reporting (usage-reporting.ts) without a real daemon. */
class SpyClient extends FakeClient {
	readonly invocations: { name: string; version: number; input: unknown }[] = [];
	override async invoke<Output = unknown>(name: string, version: number, input: unknown, options?: VehicleInvocationOptions): Promise<Output> {
		this.invocations.push({ name, version, input });
		return super.invoke(name, version, input, options);
	}
}

// The shared meta-tools are a process-wide singleton (globalThis[Symbol.for(...)]) by design --
// see vehicle-shell.ts's own ensureVehicleShellHandle doc comment -- so every test needs a fresh
// one; otherwise the second test onward would see the first test's own tools_list still "already
// registered" and skip creating its own.
beforeEach(() => {
	__resetVehicleShellHandleForTests();
	__resetInProcessVehicleRegistryForTests();
});

describe("registerVehicleTools with shell activation", () => {
	// Everything else is registered but inactive.
	it("boots with only the two meta-tools and the declared core operations active", async () => {
		const { pi, harness } = fakePi();
		await registerVehicleTools(
			pi,
			new FakeClient(manifest([operation("tasks.create"), operation("tasks.depend"), operation("docs.list")])),
			{
				shell: { coreOperations: ["tasks.create"] },
			},
		);

		expect(harness.activeTools.sort()).toEqual(["tasks_create", "tools_list", "tools_man", "tools_type"].sort());
	});

	it("registers tools_list/tools_man/tools_type with shared: true -- lets a smoke-test-based conflict scan (e.g. pi-packed's own doctor) tell a genuine, coincidental name collision apart from every Vehicle-based extension deliberately landing on the same 3 meta-tool names by design", async () => {
		const { pi, tools } = fakePi();
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create")])), { shell: { coreOperations: [] } });

		const metaTools = tools.filter((tool) => ["tools_list", "tools_man", "tools_type"].includes(tool.name));
		expect(metaTools).toHaveLength(3);
		for (const tool of metaTools) expect((tool as unknown as { shared?: boolean }).shared).toBe(true);
	});

	it("tools_list returns every operation as a one-liner, namespaced by vehicle name, without activating any of them", async () => {
		const { pi, tools, harness } = fakePi();
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create"), operation("docs.list")])), { shell: {} });

		const result = (await callTool(tools, "tools_list", {})) as { content: Array<{ text: string }> };
		expect(result.content[0]?.text).toContain("test-vehicle:tasks.create -- Run tasks.create.");
		expect(result.content[0]?.text).toContain("test-vehicle:docs.list -- Run docs.list.");
		expect(harness.activeTools).not.toContain("tasks_create");
		expect(harness.activeTools).not.toContain("docs_list");
	});

	it("tools_list filters by a query matched against name and description", async () => {
		const { pi, tools } = fakePi();
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create"), operation("docs.list")])), { shell: {} });

		const result = (await callTool(tools, "tools_list", { query: "docs" })) as { content: Array<{ text: string }> };
		expect(result.content[0]?.text).toContain("docs.list");
		expect(result.content[0]?.text).not.toContain("tasks.create");
	});

	it("tools_list treats spaces, dots, underscores, and hyphens as equivalent operation-name separators", async () => {
		const { pi, tools } = fakePi();
		await registerVehicleTools(
			pi,
			new FakeClient(manifest([operation("docs.create", { description: "Create a task document." }), operation("tasks.create")])),
			{ shell: {} },
		);

		for (const query of ["tasks create", "tasks_create", "tasks-create", "tasks.create"]) {
			const result = (await callTool(tools, "tools_list", { query })) as { content: Array<{ text: string }> };
			expect(result.content[0]?.text.split("\n")[0]).toStartWith("test-vehicle:tasks.create --");
		}
	});

	describe('tools_list mode:"regex" -- apropos\'s own default matching behavior', () => {
		it("matches a real regex against the operation name, apropos-default parity", async () => {
			const { pi, tools } = fakePi();
			await registerVehicleTools(
				pi,
				new FakeClient(manifest([operation("tasks.create"), operation("tasks.depend"), operation("docs.list")])),
				{
					shell: {},
				},
			);

			const result = (await callTool(tools, "tools_list", { query: "^test-vehicle:tasks\\.", mode: "regex" })) as {
				content: Array<{ text: string }>;
			};
			expect(result.content[0]?.text).toContain("tasks.create");
			expect(result.content[0]?.text).toContain("tasks.depend");
			expect(result.content[0]?.text).not.toContain("docs.list");
		});

		it("matches a regex against the description too, same as substring mode's name-or-description semantics", async () => {
			const { pi, tools } = fakePi();
			await registerVehicleTools(
				pi,
				new FakeClient(manifest([operation("tasks.create", { description: "Creates a real dependency chain." }), operation("docs.list")])),
				{ shell: {} },
			);

			const result = (await callTool(tools, "tools_list", { query: "depend\\w+ chain", mode: "regex" })) as {
				content: Array<{ text: string }>;
			};
			expect(result.content[0]?.text).toContain("tasks.create");
			expect(result.content[0]?.text).not.toContain("docs.list");
		});

		it("is case-insensitive, matching apropos's own case-insensitivity", async () => {
			const { pi, tools } = fakePi();
			await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create")])), { shell: {} });

			const result = (await callTool(tools, "tools_list", { query: "TASKS\\.CREATE", mode: "regex" })) as {
				content: Array<{ text: string }>;
			};
			expect(result.content[0]?.text).toContain("tasks.create");
		});

		it("an invalid regex degrades to a clear error message, never an uncaught exception", async () => {
			const { pi, tools } = fakePi();
			await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create")])), { shell: {} });

			const result = (await callTool(tools, "tools_list", { query: "(unclosed", mode: "regex" })) as { content: Array<{ text: string }> };
			expect(result.content[0]?.text).toContain('Invalid regex "(unclosed"');
		});

		it('the default (omitted mode, or mode:"substring") behaves exactly as before regex mode existed', async () => {
			const { pi, tools } = fakePi();
			await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create"), operation("docs.list")])), { shell: {} });

			const omitted = (await callTool(tools, "tools_list", { query: "docs" })) as { content: Array<{ text: string }> };
			const explicit = (await callTool(tools, "tools_list", { query: "docs", mode: "substring" })) as { content: Array<{ text: string }> };
			expect(omitted.content[0]?.text).toBe(explicit.content[0]?.text);
			expect(omitted.content[0]?.text).toContain("docs.list");
			expect(omitted.content[0]?.text).not.toContain("tasks.create");
		});
	});

	describe("tools_list effect filter -- man -s / apropos -s section-scoping parity", () => {
		it("restricts to operations with exactly the given effect", async () => {
			const { pi, tools } = fakePi();
			await registerVehicleTools(
				pi,
				new FakeClient(
					manifest([
						operation("tasks.create", { effect: "local-write" }),
						operation("tasks.list", { effect: "read" }),
						operation("tasks.remove", { effect: "destructive" }),
					]),
				),
				{ shell: {} },
			);

			const result = (await callTool(tools, "tools_list", { effect: "read" })) as { content: Array<{ text: string }> };
			expect(result.content[0]?.text).toContain("tasks.list");
			expect(result.content[0]?.text).not.toContain("tasks.create");
			expect(result.content[0]?.text).not.toContain("tasks.remove");
		});

		it("combines with query as AND, not a replacement for it", async () => {
			const { pi, tools } = fakePi();
			await registerVehicleTools(
				pi,
				new FakeClient(
					manifest([
						operation("tasks.list", { effect: "read" }),
						operation("tasks.create", { effect: "local-write" }),
						operation("docs.list", { effect: "read" }),
					]),
				),
				{ shell: {} },
			);

			const result = (await callTool(tools, "tools_list", { query: "tasks", effect: "read" })) as { content: Array<{ text: string }> };
			expect(result.content[0]?.text).toContain("test-vehicle:tasks.list -- Run tasks.list.");
			expect(result.content[0]?.text).not.toContain("test-vehicle:tasks.create");
			expect(result.content[0]?.text).not.toContain("test-vehicle:docs.list");
		});

		it("omitting effect preserves today's exact every-effect default", async () => {
			const { pi, tools } = fakePi();
			await registerVehicleTools(
				pi,
				new FakeClient(manifest([operation("tasks.create", { effect: "local-write" }), operation("tasks.list", { effect: "read" })])),
				{ shell: {} },
			);

			const result = (await callTool(tools, "tools_list", {})) as { content: Array<{ text: string }> };
			expect(result.content[0]?.text).toContain("tasks.create");
			expect(result.content[0]?.text).toContain("tasks.list");
		});
	});

	describe('tools_list scope:"name" -- apropos --names-only parity', () => {
		it('scope:"name" matches only the operation name, never an unrelated description', async () => {
			const { pi, tools } = fakePi();
			await registerVehicleTools(
				pi,
				new FakeClient(
					manifest([
						operation("tasks.create", { description: "Creates a task." }),
						operation("docs.list", { description: "Mentions tasks in passing." }),
					]),
				),
				{ shell: {} },
			);

			const allScope = (await callTool(tools, "tools_list", { query: "tasks" })) as { content: Array<{ text: string }> };
			expect(allScope.content[0]?.text).toContain("tasks.create");
			expect(allScope.content[0]?.text).toContain("docs.list"); // matches via description under the default scope

			const nameScope = (await callTool(tools, "tools_list", { query: "tasks", scope: "name" })) as { content: Array<{ text: string }> };
			expect(nameScope.content[0]?.text).toContain("tasks.create");
			expect(nameScope.content[0]?.text).not.toContain("docs.list");
		});

		it('scope:"name" also applies in regex mode', async () => {
			const { pi, tools } = fakePi();
			await registerVehicleTools(
				pi,
				new FakeClient(
					manifest([
						operation("tasks.create", { description: "Creates a task." }),
						operation("docs.list", { description: "Mentions tasks in passing." }),
					]),
				),
				{ shell: {} },
			);

			const result = (await callTool(tools, "tools_list", { query: "tasks", mode: "regex", scope: "name" })) as {
				content: Array<{ text: string }>;
			};
			expect(result.content[0]?.text).toContain("tasks.create");
			expect(result.content[0]?.text).not.toContain("docs.list");
		});

		it("omitting scope preserves today's exact name-or-description default", async () => {
			const { pi, tools } = fakePi();
			await registerVehicleTools(
				pi,
				new FakeClient(manifest([operation("tasks.create", { description: "Mentions docs in passing." }), operation("docs.list")])),
				{ shell: {} },
			);

			const omitted = (await callTool(tools, "tools_list", { query: "docs" })) as { content: Array<{ text: string }> };
			const explicit = (await callTool(tools, "tools_list", { query: "docs", scope: "all" })) as { content: Array<{ text: string }> };
			expect(omitted.content[0]?.text).toBe(explicit.content[0]?.text);
			expect(omitted.content[0]?.text).toContain("tasks.create");
			expect(omitted.content[0]?.text).toContain("docs.list");
		});
	});

	describe('tools_list verbosity:"high" -- man/whatis-style terse-vs-full spectrum', () => {
		it("appends each match's own parameter/schema summary", async () => {
			const { pi, tools } = fakePi();
			await registerVehicleTools(
				pi,
				new FakeClient(
					manifest([
						operation("tasks.create", {
							inputSchema: { type: "object", properties: { title: { type: "string" } }, required: ["title"] },
						}),
					]),
				),
				{ shell: {} },
			);

			const result = (await callTool(tools, "tools_list", { verbosity: "high" })) as { content: Array<{ text: string }> };
			expect(result.content[0]?.text).toContain("test-vehicle:tasks.create -- Run tasks.create.");
			expect(result.content[0]?.text).toContain("parameters:");
			expect(result.content[0]?.text).toContain("title (string, required)");
		});

		it("never activates anything or performs a separate tools_man call -- purely a formatting choice", async () => {
			const { pi, tools, harness } = fakePi();
			await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create")])), { shell: {} });

			await callTool(tools, "tools_list", { verbosity: "high" });
			expect(harness.activeTools).not.toContain("tasks_create");
		});

		it("an operation with no declared parameters gets just the one-liner, no empty parameters: section", async () => {
			const { pi, tools } = fakePi();
			await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create", { inputSchema: { type: "object" } })])), {
				shell: {},
			});

			const result = (await callTool(tools, "tools_list", { query: "test-vehicle:tasks.create", verbosity: "high" })) as {
				content: Array<{ text: string }>;
			};
			expect(result.content[0]?.text).toBe("test-vehicle:tasks.create -- Run tasks.create.");
		});

		it('omitting verbosity (or verbosity:"low") preserves today\'s exact one-liner-only output', async () => {
			const { pi, tools } = fakePi();
			await registerVehicleTools(
				pi,
				new FakeClient(
					manifest([operation("tasks.create", { inputSchema: { type: "object", properties: { title: { type: "string" } } } })]),
				),
				{ shell: {} },
			);

			const omitted = (await callTool(tools, "tools_list", { query: "test-vehicle:tasks.create" })) as { content: Array<{ text: string }> };
			const explicit = (await callTool(tools, "tools_list", { query: "test-vehicle:tasks.create", verbosity: "low" })) as {
				content: Array<{ text: string }>;
			};
			expect(omitted.content[0]?.text).toBe("test-vehicle:tasks.create -- Run tasks.create.");
			expect(omitted.content[0]?.text).toBe(explicit.content[0]?.text);
		});
	});

	describe("tools_man SEE ALSO -- related-operations cross-referencing (man's own convention)", () => {
		it("lists every other operation from the same vehicle sharing the same dot-separated namespace prefix", async () => {
			const { pi, tools } = fakePi();
			await registerVehicleTools(
				pi,
				new FakeClient(
					manifest([operation("tasks.create"), operation("tasks.depend"), operation("tasks.contain"), operation("docs.create")]),
				),
				{ shell: {} },
			);

			const result = (await callTool(tools, "tools_man", { names: ["test-vehicle:tasks.create"] })) as { content: Array<{ text: string }> };
			expect(result.content[0]?.text).toContain("see also: test-vehicle:tasks.depend, test-vehicle:tasks.contain");
			expect(result.content[0]?.text).not.toContain("docs.create");
		});

		it("omits the section entirely when the vehicle has no other operation sharing this namespace prefix", async () => {
			const { pi, tools } = fakePi();
			await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create")])), { shell: {} });

			const result = (await callTool(tools, "tools_man", { names: ["test-vehicle:tasks.create"] })) as { content: Array<{ text: string }> };
			expect(result.content[0]?.text).not.toContain("see also");
		});
	});

	it("tools_man recursively documents nested schemas, constraints, enums, and examples", async () => {
		const { pi, tools } = fakePi();
		await registerVehicleTools(
			pi,
			new FakeClient(
				manifest([
					operation("tasks.create", {
						inputSchema: {
							type: "object",
							properties: {
								gates: {
									type: "array",
									minItems: 1,
									items: {
										type: "object",
										properties: { type: { type: "string", enum: ["command", "test"] }, target: { type: "string" } },
										required: ["type", "target"],
									},
									examples: [[{ type: "command", target: "bun test" }]],
								},
							},
						},
					}),
				]),
			),
			{ shell: {} },
		);

		const result = (await callTool(tools, "tools_man", { names: ["test-vehicle:tasks.create"] })) as { content: Array<{ text: string }> };
		const text = result.content[0]?.text ?? "";
		expect(text).toContain("gates (array, optional; minItems: 1)");
		expect(text).toContain("items (object)");
		expect(text).toContain("type (string, required; enum: command | test)");
		expect(text).toContain('example: [{"type":"command","target":"bun test"}]');
	});

	it("tools_man activates a discovered operation for the model's next turn", async () => {
		const { pi, tools, harness } = fakePi();
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.depend")])), { shell: {} });
		expect(harness.activeTools).not.toContain("tasks_depend");

		const result = (await callTool(tools, "tools_man", { names: ["test-vehicle:tasks.depend"] })) as { content: Array<{ text: string }> };
		expect(result.content[0]?.text).toContain("tasks_depend (test-vehicle:tasks.depend, v1)");
		expect(result.content[0]?.text).toContain("now callable as tasks_depend");
		expect(harness.activeTools).toContain("tasks_depend");
	});

	it("tools_man allows skip-ahead -- a name never surfaced by tools_list still activates", async () => {
		const { pi, tools, harness } = fakePi();
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.depend"), operation("docs.list")])), { shell: {} });

		await callTool(tools, "tools_man", { names: ["test-vehicle:docs.list"] });
		expect(harness.activeTools).toContain("docs_list");
	});

	// Points the caller at tools_list, and never activates the unknown name.
	it("tools_man reports an unknown operation name without activating it", async () => {
		const { pi, tools, harness } = fakePi();
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.depend")])), { shell: {} });

		const result = (await callTool(tools, "tools_man", { names: ["nonexistent.op"] })) as { content: Array<{ text: string }> };
		expect(result.content[0]?.text).toContain("no such operation");
		expect(result.content[0]?.text).toContain("tools_list");
		expect(harness.activeTools).not.toContain("nonexistent_op");
	});

	// Impossibly tiny budget -- any real tool's own weight exceeds it, so eviction fires the moment
	// an entry loses its "called/seeded this turn" protection window (see weighted-lru.ts).
	const zeroBudget = { minToolBudgetTokens: 1, maxToolBudgetTokens: 1, fallbackBudgetTokens: 1 };

	it("a discovered operation is evicted under context pressure once its just-activated protection window ends", async () => {
		const { pi, tools, harness } = fakePi();
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.depend")])), { shell: { budget: zeroBudget } });
		await callTool(tools, "tools_man", { names: ["test-vehicle:tasks.depend"] });
		expect(harness.activeTools).toContain("tasks_depend");

		await harness.emit("turn_end", { turnIndex: 0, message: {}, toolResults: [] });
		expect(harness.activeTools).toContain("tasks_depend"); // protected -- just activated this very turn

		await harness.emit("turn_end", { turnIndex: 1, message: {}, toolResults: [] });
		expect(harness.activeTools).not.toContain("tasks_depend"); // unprotected now, budget forces eviction
	});

	it("calling a discovered operation re-protects it from eviction, instead of losing the protection while in use", async () => {
		const { pi, tools, harness } = fakePi();
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.depend")])), { shell: { budget: zeroBudget } });
		await callTool(tools, "tools_man", { names: ["test-vehicle:tasks.depend"] });

		await harness.emit("turn_end", { turnIndex: 0, message: {}, toolResults: [] }); // protected by seed -- survives
		await harness.emit("tool_execution_end", { toolCallId: "x", toolName: "tasks_depend", result: {}, isError: false });
		await harness.emit("turn_end", { turnIndex: 1, message: {}, toolResults: [] }); // protected again by the call -- survives
		expect(harness.activeTools).toContain("tasks_depend");

		await harness.emit("turn_end", { turnIndex: 2, message: {}, toolResults: [] }); // not called since -- evicted now
		expect(harness.activeTools).not.toContain("tasks_depend");
	});

	// Not permanently pinned.
	it("a core operation is also subject to eviction under context pressure once unused", async () => {
		const { pi, harness } = fakePi();
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create")])), {
			shell: { coreOperations: ["tasks.create"], budget: zeroBudget },
		});
		expect(harness.activeTools).toContain("tasks_create");

		await harness.emit("turn_end", { turnIndex: 0, message: {}, toolResults: [] });
		expect(harness.activeTools).toContain("tasks_create"); // protected -- just seeded at registration

		await harness.emit("turn_end", { turnIndex: 1, message: {}, toolResults: [] });
		expect(harness.activeTools).not.toContain("tasks_create");
		expect(harness.activeTools).toContain("tools_list");
		expect(harness.activeTools).toContain("tools_man");
	});

	it("never activates an unavailable operation via tools_man", async () => {
		const { pi, tools, harness } = fakePi();
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.depend", { available: false })])), { shell: {} });

		const result = (await callTool(tools, "tools_man", { names: ["test-vehicle:tasks.depend"] })) as { content: Array<{ text: string }> };
		expect(result.content[0]?.text).toContain("currently unavailable");
		expect(harness.activeTools).not.toContain("tasks_depend");
	});

	// Matches initial registration's own seeding.
	it("refreshVehicleToolAvailability re-seeds a core operation that just became available", async () => {
		const { pi, harness } = fakePi();
		const client = new FakeClient(manifest([operation("tasks.create", { available: false })]));
		const registered = await registerVehicleTools(pi, client, { shell: { coreOperations: ["tasks.create"] } });
		expect(harness.activeTools).not.toContain("tasks_create");

		client.value = manifest([operation("tasks.create", { available: true })]);
		await refreshVehicleToolAvailability(pi, client, registered, { shell: { coreOperations: ["tasks.create"] } });
		expect(harness.activeTools).toContain("tasks_create");
	});

	// Doesn't reset every available tool active.
	it("refreshVehicleToolAvailability leaves an already-unprotected discovered tool's standing alone", async () => {
		const { pi, tools, harness } = fakePi();
		const client = new FakeClient(manifest([operation("tasks.depend")]));
		const registered = await registerVehicleTools(pi, client, { shell: { budget: zeroBudget } });
		await callTool(tools, "tools_man", { names: ["test-vehicle:tasks.depend"] });

		await harness.emit("turn_end", { turnIndex: 0, message: {}, toolResults: [] }); // protected by seed -- survives
		await refreshVehicleToolAvailability(pi, client, registered, { shell: { budget: zeroBudget } });
		expect(harness.activeTools).toContain("tasks_depend"); // refresh must not re-grant protection (already tracked)

		await harness.emit("turn_end", { turnIndex: 1, message: {}, toolResults: [] }); // unprotected -- evicted now
		expect(harness.activeTools).not.toContain("tasks_depend");
	});

	// Today's non-shell behavior is unchanged.
	it("without options.shell, every available operation is active immediately", async () => {
		const { pi, harness } = fakePi();
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create"), operation("tasks.depend")])), {});

		expect(harness.activeTools.sort()).toEqual(["tasks_create", "tasks_depend"].sort());
		expect(harness.activeTools).not.toContain("tools_list");
		expect(harness.activeTools).not.toContain("tools_man");
	});

	// The deprecated coreTtlTurns/discoveredTtlTurns fields are still real, not a silent no-op --
	// they scale the budget bounds proportionally (see bootstrap.ts's legacyTtlBudgetScaleFactor).
	// Setting both to 0 collapses every budget bound to 0, exactly like a real, explicit zero budget.
	it("the deprecated coreTtlTurns/discoveredTtlTurns fields still have a real effect -- scaling the budget, not a silent no-op", async () => {
		const { pi, tools, harness } = fakePi();
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.depend")])), {
			shell: { coreTtlTurns: 0, discoveredTtlTurns: 0 },
		});
		await callTool(tools, "tools_man", { names: ["test-vehicle:tasks.depend"] });
		expect(harness.activeTools).toContain("tasks_depend");

		await harness.emit("turn_end", { turnIndex: 0, message: {}, toolResults: [] }); // protected -- just activated
		expect(harness.activeTools).toContain("tasks_depend");

		await harness.emit("turn_end", { turnIndex: 1, message: {}, toolResults: [] }); // unprotected -- 0 budget forces eviction
		expect(harness.activeTools).not.toContain("tasks_depend");
	});
});

describe("registerVehicleTools honors VEHICLE_SHELL_DISABLED", () => {
	const ORIGINAL_ENV = process.env.VEHICLE_SHELL_DISABLED;
	afterEach(() => {
		if (ORIGINAL_ENV === undefined) delete process.env.VEHICLE_SHELL_DISABLED;
		else process.env.VEHICLE_SHELL_DISABLED = ORIGINAL_ENV;
	});

	it("forces shell off and activates every operation directly, overriding a consumer's own shell option", async () => {
		process.env.VEHICLE_SHELL_DISABLED = "1";
		const { pi, harness } = fakePi();
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create"), operation("docs.list")])), {
			shell: { coreOperations: ["tasks.create"] },
		});

		expect(harness.activeTools.sort()).toEqual(["tasks_create", "docs_list"].sort());
		expect(harness.activeTools).not.toContain("tools_list");
		expect(harness.activeTools).not.toContain("tools_man");
	});

	it("leaves shell mode alone when unset", async () => {
		delete process.env.VEHICLE_SHELL_DISABLED;
		const { pi, harness } = fakePi();
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create"), operation("docs.list")])), {
			shell: { coreOperations: ["tasks.create"] },
		});

		expect(harness.activeTools.sort()).toEqual(["tasks_create", "tools_list", "tools_man", "tools_type"].sort());
	});
});

describe("the shared meta-tools discover every vehicle in the process, regardless of which one created them", () => {
	it("merges a second registerVehicleTools() call's operations in automatically, with no configuration on either side beyond shell -- stacks instead of racing", async () => {
		// Points the real default discoverForeignVehicles() at an empty temp dir so this test's
		// assertions only reflect the in-process registry, not whatever real Vehicle daemons
		// happen to be running on the machine executing this test.
		const originalXdgRuntimeDir = process.env.XDG_RUNTIME_DIR;
		const emptyDir = mkdtempSync(join(tmpdir(), "vehicle-shell-registry-test-"));
		process.env.XDG_RUNTIME_DIR = emptyDir;
		try {
			const { pi, tools } = fakePi();
			// Papyrus registers first -- neither vehicle needs any option beyond its own shell;
			// there is no more "ownership" for either of them to win or lose.
			await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create"), operation("docs.create")], "papyrus")), {
				shell: {},
			});
			await registerVehicleTools(pi, new FakeClient(manifest([operation("ci.status")], "pipes")), { shell: {} });

			const result = (await callTool(tools, "tools_list", {})) as { content: Array<{ text: string }> };
			expect(result.content[0]?.text).toContain("pipes:ci.status -- Run ci.status.");
			expect(result.content[0]?.text).toContain("papyrus:tasks.create -- Run tasks.create.");
			expect(result.content[0]?.text).toContain("papyrus:docs.create -- Run docs.create.");
		} finally {
			if (originalXdgRuntimeDir === undefined) delete process.env.XDG_RUNTIME_DIR;
			else process.env.XDG_RUNTIME_DIR = originalXdgRuntimeDir;
			rmSync(emptyDir, { recursive: true, force: true });
		}
	});

	it("cross-process discovery throwing never breaks tools_list's own in-process listing", async () => {
		const originalXdgRuntimeDir = process.env.XDG_RUNTIME_DIR;
		// A path that can never be listed (not a directory at all) reproduces a real discovery
		// failure without needing to inject a fake -- discoverForeignVehicles degrades to [] on
		// any readdir failure, exactly like an unreadable/nonexistent handle directory would.
		process.env.XDG_RUNTIME_DIR = join(tmpdir(), "vehicle-shell-nonexistent-handle-dir-does-not-exist");
		try {
			const { pi, tools } = fakePi();
			await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create")])), { shell: {} });

			const result = (await callTool(tools, "tools_list", {})) as { content: Array<{ text: string }> };
			expect(result.content[0]?.text).toBe("test-vehicle:tasks.create -- Run tasks.create.");
		} finally {
			if (originalXdgRuntimeDir === undefined) delete process.env.XDG_RUNTIME_DIR;
			else process.env.XDG_RUNTIME_DIR = originalXdgRuntimeDir;
		}
	});

	it("tools_man for a known operation is unaffected by another vehicle also being in the process -- it was already pre-registered (unprefixed) by its own vehicle's registration, same as today", async () => {
		const { pi, tools, harness } = fakePi();
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create")], "papyrus")), { shell: {} });
		await registerVehicleTools(pi, new FakeClient(manifest([operation("ci.status")], "pipes")), { shell: {} });

		const result = (await callTool(tools, "tools_man", { names: ["papyrus:tasks.create"] })) as { content: Array<{ text: string }> };
		expect(result.content[0]?.text).toContain("now callable as tasks_create");
		expect(harness.activeTools).toContain("tasks_create");
	});

	it("tools_man for a name that's neither known locally nor discoverable keeps today's exact unknown-operation message", async () => {
		const { pi, tools } = fakePi();
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create")], "papyrus")), { shell: {} });

		const result = (await callTool(tools, "tools_man", { names: ["nonexistent.operation"] })) as { content: Array<{ text: string }> };
		expect(result.content[0]?.text).toBe("nonexistent.operation: no such operation. Use tools_list to browse available names.");
	});

	// A vehicle registered directly into the in-process registry (not via registerVehicleTools())
	// never pre-registers any of its own operations as Pi tools -- the same shape a genuinely
	// cross-process daemon-only vehicle (no local Pi extension of its own) has. This is the one
	// real case that still needs dynamic, on-demand activation through the vehicle's own
	// activateOperation closure, exactly like a truly new operation a live manifest re-fetch reveals.
	it("tools_man dynamically routes to and registers a real, callable Pi tool for a vehicle that never pre-registered its own operations, using THAT vehicle's own activation policy", async () => {
		const { pi, tools, harness } = fakePi();
		const zeroBudget = { minToolBudgetTokens: 1, maxToolBudgetTokens: 1, fallbackBudgetTokens: 1 };
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create")], "papyrus")), { shell: { budget: zeroBudget } });

		const invocations: Array<{ name: string; version: number; input: unknown }> = [];
		const packedManifest = manifest(
			[operation("package.install", { inputSchema: { type: "object", properties: { name: { type: "string" } } } })],
			"packed",
		);
		registerInProcessVehicle(
			"packed",
			packedManifest,
			{ manifest: () => Promise.resolve(packedManifest) } as VehicleClient,
			(descriptor) => {
				const toolName = `packed_${descriptor.name.replace(/\./g, "_")}`;
				pi.registerTool({
					name: toolName,
					label: descriptor.name,
					description: descriptor.description,
					parameters: descriptor.inputSchema as never,
					async execute(_id, params) {
						invocations.push({ name: descriptor.name, version: descriptor.version, input: params });
						return { content: [{ type: "text", text: "installed" }], details: {} };
					},
				});
				return toolName;
			},
		);

		const result = (await callTool(tools, "tools_man", { names: ["packed:package.install"] })) as { content: Array<{ text: string }> };
		expect(result.content[0]?.text).toContain("now callable as packed_package_install");
		expect(harness.activeTools).toContain("packed_package_install");

		// A second tools_man call on the same operation must not re-activate/re-register it.
		await callTool(tools, "tools_man", { names: ["packed:package.install"] });
		expect(invocations.length).toBe(0); // registering isn't calling -- only an actual tool call is

		// Proves it's genuinely callable, using packed's own activateOperation, not just claimed.
		await callTool(tools, "packed_package_install", { name: "curl" });
		expect(invocations).toEqual([{ name: "package.install", version: 1, input: { name: "curl" } }]);

		// Subject to the same eviction-under-pressure as any other discovered operation: protected
		// through the turn_end right after its last real use, evicted the first one after that.
		await harness.emit("turn_end", { turnIndex: 0, message: {}, toolResults: [] }); // protected -- called moments ago
		expect(harness.activeTools).toContain("packed_package_install");
		await harness.emit("turn_end", { turnIndex: 1, message: {}, toolResults: [] });
		expect(harness.activeTools).not.toContain("packed_package_install");
	});

	it("activation throwing (e.g. a Pi tool-name collision) reports a friendly failure without crashing tools_man", async () => {
		const { pi, tools } = fakePi({ existingTools: ["packed_package_install"] });
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create")], "papyrus")), { shell: {} });
		const packedManifest = manifest([operation("package.install")], "packed");
		registerInProcessVehicle("packed", packedManifest, { manifest: () => Promise.resolve(packedManifest) } as VehicleClient, () => {
			throw new Error("Pi tool 'packed_package_install' is already registered");
		});

		const result = (await callTool(tools, "tools_man", { names: ["packed:package.install"] })) as { content: Array<{ text: string }> };
		expect(result.content[0]?.text).toBe(
			"packed:package.install: could not activate -- Pi tool 'packed_package_install' is already registered.",
		);
	});
});

describe("the shared meta-tools are registered exactly once, no matter how many vehicles enable shell mode", () => {
	it("a second vehicle's own registerVehicleTools() call never registers a redundant tools_list/tools_man/tools_type -- pure dead weight, Pi has no unregisterTool()", async () => {
		const { pi, tools } = fakePi();
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create")], "papyrus")), { shell: {} });
		const countAfterFirst = tools.filter((tool) => tool.name === "tools_list").length;
		await registerVehicleTools(pi, new FakeClient(manifest([operation("ci.status")], "pipes")), { shell: {} });

		expect(countAfterFirst).toBe(1);
		expect(tools.filter((tool) => tool.name === "tools_list").length).toBe(1);
		expect(tools.filter((tool) => tool.name === "tools_man").length).toBe(1);
		expect(tools.filter((tool) => tool.name === "tools_type").length).toBe(1);
	});

	it("an extension with a pre-existing tools_list registered by something else entirely never registers its own -- and still registers/activates its own core operations normally", async () => {
		const { pi, tools, harness } = fakePi({ existingTools: ["tools_list"] });
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create")])), {
			shell: { coreOperations: ["tasks.create"] },
		});

		expect(tools.find((tool) => tool.name === "tools_list")).toBeUndefined();
		expect(tools.find((tool) => tool.name === "tools_man")).toBeUndefined();
		expect(tools.find((tool) => tool.name === "tasks_create")).toBeDefined();
		expect(harness.activeTools).toContain("tasks_create");
	});

	it("never touches an unrelated extension's pre-existing tools_list/tools_man active state -- doesn't own them, so never adds or removes them via setActiveTools", async () => {
		const { pi, harness } = fakePi({ existingTools: ["tools_list", "tools_man"] });
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create")])), { shell: {} });

		// Started active (existingTools' own default) and must stay that way -- untouched, not
		// re-added by us (which would be indistinguishable from "left alone" here, but the next
		// assertion -- decaying our own tools_man -- proves we genuinely never mis-manage them).
		expect(harness.activeTools).toContain("tools_list");
		expect(harness.activeTools).toContain("tools_man");

		for (let turn = 0; turn < 30; turn++) {
			await harness.emit("turn_end", { turnIndex: turn, message: {}, toolResults: [] });
		}
		expect(harness.activeTools).toContain("tools_list");
		expect(harness.activeTools).toContain("tools_man");
	});

	it("without any pre-existing tools_list, registers all three meta-tools exactly once", async () => {
		const { pi, tools, harness } = fakePi();
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create")])), { shell: {} });

		expect(tools.find((tool) => tool.name === "tools_list")).toBeDefined();
		expect(tools.find((tool) => tool.name === "tools_man")).toBeDefined();
		expect(tools.find((tool) => tool.name === "tools_type")).toBeDefined();
		expect(harness.activeTools).toContain("tools_list");
		expect(harness.activeTools).toContain("tools_man");
		expect(harness.activeTools).toContain("tools_type");
	});

	describe("tools_man bare (unprefixed) name resolution -- type -a parity", () => {
		it("resolves a bare name to its one real owning vehicle, exactly as if it had been fully namespaced", async () => {
			const { pi, tools, harness } = fakePi();
			await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.depend")], "papyrus")), { shell: {} });

			const result = (await callTool(tools, "tools_man", { names: ["tasks.depend"] })) as { content: Array<{ text: string }> };
			expect(result.content[0]?.text).toContain("tasks_depend (papyrus:tasks.depend, v1)");
			expect(result.content[0]?.text).toContain("now callable as tasks_depend");
			expect(harness.activeTools).toContain("tasks_depend");
		});

		it("a bare name with zero matches keeps today's exact unknown-operation message", async () => {
			const { pi, tools } = fakePi();
			await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.depend")], "papyrus")), { shell: {} });

			const result = (await callTool(tools, "tools_man", { names: ["nonexistent"] })) as { content: Array<{ text: string }> };
			expect(result.content[0]?.text).toBe("nonexistent: no such operation. Use tools_list to browse available names.");
		});

		// Two vehicles both eagerly pre-registering the SAME operation name (e.g. via registerVehicleTools
		// for both) would collide at Pi-tool-registration time regardless of this feature -- a real,
		// pre-existing constraint unrelated to bare-name resolution. The genuinely realistic shape for two
		// vehicles sharing an operation name is each one discovered live (registerInProcessVehicle,
		// exactly like the existing "packed" tests below), where nothing is registered until tools_man
		// actually activates it -- so an ambiguous bare name never needs to reach activation at all.
		it("a bare name matching more than one vehicle's own operation refuses to guess, listing every real candidate", async () => {
			const { pi, tools, harness } = fakePi();
			const papyrusManifest = manifest([operation("docs.create")], "papyrus");
			const webSpiderManifest = manifest([operation("docs.create")], "web-spider");
			registerInProcessVehicle("papyrus", papyrusManifest, { manifest: () => Promise.resolve(papyrusManifest) } as VehicleClient, () => {
				throw new Error("must never be called -- ambiguity must be caught before any activation attempt");
			});
			registerInProcessVehicle(
				"web-spider",
				webSpiderManifest,
				{ manifest: () => Promise.resolve(webSpiderManifest) } as VehicleClient,
				() => {
					throw new Error("must never be called -- ambiguity must be caught before any activation attempt");
				},
			);
			await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create")], "unrelated")), { shell: {} });

			const result = (await callTool(tools, "tools_man", { names: ["docs.create"] })) as { content: Array<{ text: string }> };
			expect(result.content[0]?.text).toContain("ambiguous");
			expect(result.content[0]?.text).toContain("papyrus:docs.create");
			expect(result.content[0]?.text).toContain("web-spider:docs.create");
			expect(harness.activeTools).not.toContain("docs_create");
		});

		it("the existing fully-namespaced path is completely unaffected by bare-name resolution existing", async () => {
			const { pi, tools, harness } = fakePi();
			const papyrusManifest = manifest([operation("docs.create")], "papyrus");
			const webSpiderManifest = manifest([operation("docs.create")], "web-spider");
			registerInProcessVehicle("papyrus", papyrusManifest, { manifest: () => Promise.resolve(papyrusManifest) } as VehicleClient, () => {
				throw new Error("must never be called in this test");
			});
			registerInProcessVehicle(
				"web-spider",
				webSpiderManifest,
				{ manifest: () => Promise.resolve(webSpiderManifest) } as VehicleClient,
				() => "web_spider_docs_create",
			);
			await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create")], "unrelated")), { shell: {} });

			const result = (await callTool(tools, "tools_man", { names: ["web-spider:docs.create"] })) as { content: Array<{ text: string }> };
			expect(result.content[0]?.text).toContain("docs_create (web-spider:docs.create, v1)");
			expect(result.content[0]?.text).toContain("now callable as web_spider_docs_create");
			expect(harness.activeTools).toContain("web_spider_docs_create");
		});
	});

	describe("tools_type -- a real type-equivalent resolution-status meta-tool", () => {
		it("reports a core operation as active, with its real toolName and its own estimated weight", async () => {
			const { pi, tools } = fakePi();
			const descriptor = operation("tasks.create");
			await registerVehicleTools(pi, new FakeClient(manifest([descriptor], "papyrus")), {
				shell: { coreOperations: ["tasks.create"] },
			});

			const result = (await callTool(tools, "tools_type", { names: ["papyrus:tasks.create"] })) as { content: Array<{ text: string }> };
			const weight = estimateToolWeightTokens({ name: "tasks_create", description: descriptor.description, parameters: descriptor.inputSchema });
			// The only tracked entry is trivially its own lowest-priority one -- reported as near eviction.
			expect(result.content[0]?.text).toBe(
				`papyrus:tasks.create: active -- callable now as tasks_create (~${weight} token(s) of context) -- least protected right now, likely first evicted under context pressure.`,
			);
		});

		it("reports a non-core operation as dormant until tools_man activates it, then active afterward", async () => {
			const { pi, tools } = fakePi();
			await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.depend")], "papyrus")), { shell: {} });

			const before = (await callTool(tools, "tools_type", { names: ["papyrus:tasks.depend"] })) as { content: Array<{ text: string }> };
			expect(before.content[0]?.text).toContain("dormant");

			await callTool(tools, "tools_man", { names: ["papyrus:tasks.depend"] });

			const after = (await callTool(tools, "tools_type", { names: ["papyrus:tasks.depend"] })) as { content: Array<{ text: string }> };
			expect(after.content[0]?.text).toContain("active -- callable now as tasks_depend");
		});

		it("never activates anything or extends any TTL itself, unlike tools_man -- purely read-only", async () => {
			const { pi, tools, harness } = fakePi();
			await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.depend")], "papyrus")), {
				shell: { budget: { minToolBudgetTokens: 1, maxToolBudgetTokens: 1, fallbackBudgetTokens: 1 } },
			});
			await callTool(tools, "tools_man", { names: ["papyrus:tasks.depend"] });
			expect(harness.activeTools).toContain("tasks_depend");

			// Two full turns of calling ONLY tools_type (never tools_man, never the activated tool itself) --
			// if tools_type refreshed the TTL as a side effect, this would still be active; it must decay
			// exactly as if tools_type had never been called at all.
			await callTool(tools, "tools_type", { names: ["papyrus:tasks.depend"] });
			await harness.emit("turn_end", { turnIndex: 0, message: {}, toolResults: [] });
			await callTool(tools, "tools_type", { names: ["papyrus:tasks.depend"] });
			await harness.emit("turn_end", { turnIndex: 1, message: {}, toolResults: [] });

			expect(harness.activeTools).not.toContain("tasks_depend");
		});

		it("reports an unavailable operation as blocked", async () => {
			const { pi, tools } = fakePi();
			await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.depend", { available: false })], "papyrus")), { shell: {} });

			const result = (await callTool(tools, "tools_type", { names: ["papyrus:tasks.depend"] })) as { content: Array<{ text: string }> };
			expect(result.content[0]?.text).toContain("blocked");
		});

		it("reports a completely unknown name as unknown, distinct from a real vehicle's unreachable one", async () => {
			const { pi, tools } = fakePi();
			await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create")], "papyrus")), { shell: {} });

			const result = (await callTool(tools, "tools_type", { names: ["nonexistent:operation"] })) as { content: Array<{ text: string }> };
			expect(result.content[0]?.text).toBe(
				"nonexistent:operation: unknown -- no such operation is currently discoverable. Use tools_list to browse available names.",
			);
		});

		it("reports a bare name matching more than one vehicle as ambiguous, listing every real candidate", async () => {
			const { pi, tools } = fakePi();
			const papyrusManifest = manifest([operation("docs.create")], "papyrus");
			const webSpiderManifest = manifest([operation("docs.create")], "web-spider");
			registerInProcessVehicle("papyrus", papyrusManifest, { manifest: () => Promise.resolve(papyrusManifest) } as VehicleClient, () => {
				throw new Error("must never be called");
			});
			registerInProcessVehicle(
				"web-spider",
				webSpiderManifest,
				{ manifest: () => Promise.resolve(webSpiderManifest) } as VehicleClient,
				() => {
					throw new Error("must never be called");
				},
			);
			await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create")], "unrelated")), { shell: {} });

			const result = (await callTool(tools, "tools_type", { names: ["docs.create"] })) as { content: Array<{ text: string }> };
			expect(result.content[0]?.text).toContain("ambiguous");
			expect(result.content[0]?.text).toContain("papyrus:docs.create");
			expect(result.content[0]?.text).toContain("web-spider:docs.create");
		});

		it("handles several names in one call, each classified independently", async () => {
			const { pi, tools } = fakePi();
			await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create"), operation("tasks.depend")], "papyrus")), {
				shell: { coreOperations: ["tasks.create"] },
			});

			const result = (await callTool(tools, "tools_type", {
				names: ["papyrus:tasks.create", "papyrus:tasks.depend", "nonexistent"],
			})) as { content: Array<{ text: string }>; details: { results: Array<{ name: string; status: string }> } };
			expect(result.details.results.map((entry) => entry.status)).toEqual(["active", "dormant", "unknown"]);
		});
	});
});

describe("tools_list's opt-in aggregate cache (mandb-style index vs. live rescan)", () => {
	it("defaults to OFF -- every call fetches fresh, exactly as before this feature existed", async () => {
		const { pi, tools } = fakePi();
		const client = new FakeClient(manifest([operation("tasks.create")]));
		await registerVehicleTools(pi, client, { shell: {} });
		// registerVehicleTools' own initial setup already did one unrelated manifest() fetch to build
		// its own Pi tool projection -- reset the counter so this test measures only what its own two
		// explicit tools_list calls below actually do.
		client.manifestCalls = 0;

		await callTool(tools, "tools_list", {});
		await callTool(tools, "tools_list", {});
		expect(client.manifestCalls).toBe(2);
	});

	it("opting in (aggregateCacheTtlMs > 0): a second call within the TTL is served from cache, no redundant fetch", async () => {
		const { pi, tools } = fakePi();
		const client = new FakeClient(manifest([operation("tasks.create")]));
		await registerVehicleTools(pi, client, { shell: { aggregateCacheTtlMs: 60_000 } });
		client.manifestCalls = 0;

		await callTool(tools, "tools_list", {});
		await callTool(tools, "tools_list", {});
		expect(client.manifestCalls).toBe(1);
	});

	it("a cache hit still reflects the real operations -- serving from cache is invisible to the caller", async () => {
		const { pi, tools } = fakePi();
		const client = new FakeClient(manifest([operation("tasks.create"), operation("docs.list")]));
		await registerVehicleTools(pi, client, { shell: { aggregateCacheTtlMs: 60_000 } });
		client.manifestCalls = 0;

		await callTool(tools, "tools_list", {});
		const second = (await callTool(tools, "tools_list", {})) as { content: Array<{ text: string }> };
		expect(second.content[0]?.text).toContain("tasks.create");
		expect(second.content[0]?.text).toContain("docs.list");
		expect(client.manifestCalls).toBe(1);
	});

	it("past expiry, a fresh fetch happens again -- a real Vehicle version bump is never invisible past the TTL", async () => {
		const { pi, tools } = fakePi();
		const client = new FakeClient(manifest([operation("tasks.create")]));
		await registerVehicleTools(pi, client, { shell: { aggregateCacheTtlMs: 10 } });
		client.manifestCalls = 0;

		await callTool(tools, "tools_list", {});
		await new Promise((resolve) => setTimeout(resolve, 30));
		await callTool(tools, "tools_list", {});
		expect(client.manifestCalls).toBe(2);
	});

	it("tools_man stays always-fresh regardless of tools_list's own cache -- a real new operation is immediately activatable even while a huge TTL would still hide it from tools_list", async () => {
		const { pi, tools } = fakePi();
		const client = new FakeClient(manifest([operation("tasks.create")]));
		await registerVehicleTools(pi, client, { shell: { aggregateCacheTtlMs: 60_000 } });

		// Populates tools_list's own cache with the pre-mutation manifest.
		const before = (await callTool(tools, "tools_list", {})) as { content: Array<{ text: string }> };
		expect(before.content[0]?.text).not.toContain("test-vehicle:tasks.depend");

		// A real live mutation, well within the still-live 60s TTL -- reassigning the client's own
		// manifest is what a real daemon's own live manifest re-fetch would produce.
		client.value = manifest([operation("tasks.create"), operation("tasks.depend")]);

		// tools_list still doesn't see it -- serving the cached snapshot exactly as configured.
		const stillCached = (await callTool(tools, "tools_list", {})) as { content: Array<{ text: string }> };
		expect(stillCached.content[0]?.text).not.toContain("test-vehicle:tasks.depend");

		// tools_man, unaffected by tools_list's cache, activates it immediately.
		const manResult = (await callTool(tools, "tools_man", { names: ["test-vehicle:tasks.depend"] })) as {
			content: Array<{ text: string }>;
		};
		expect(manResult.content[0]?.text).toContain("now callable as test_vehicle_tasks_depend");
	});
});

/**
 * Real incident: globalThis[Symbol.for("vehicle.shell.handle@1")] is process-wide, not tied to
 * any one extension instance, so it survives a real /reload -- but pi's own reload flow "reloads
 * and rebinds extensions" (extensions.md), tearing down every pi.registerTool()/pi.on() call the
 * OLD extension instance made. ensureVehicleShellHandle's own "if (existing) return existing"
 * short-circuit (before this suite's own fix) treated the handle's mere existence as proof its
 * tools/listeners were still live, silently leaving tools_list/tools_man/tools_type (and the
 * recordCall/evictToBudget event wiring) gone process-wide after ANY reload, for every vehicle,
 * until a full process restart. Confirmed live: reloading this exact package after an upgrade left
 * tools_list/tools_man both reporting "Tool ... not found" while flat, non-shell tools kept
 * working fine -- exactly the asymmetry this suite reproduces with createExtensionHarness's own
 * reload() (which faithfully mirrors AgentSession.reload()'s real "brand-new ExtensionRunner with
 * an empty tools Map, same api, fresh factory() call" semantics, not a hand-rolled approximation).
 */
describe("Vehicle Shell's own meta-tools across a simulated /reload", () => {
	function shellStyleFactory(client: VehicleClient) {
		return (pi: ExtensionAPI) => {
			pi.on("session_start", async () => {
				await registerVehicleTools(pi, client, { shell: { coreOperations: ["tasks.create"] } });
			});
		};
	}

	it("tools_list/tools_man/tools_type are all still registered and callable after reload, not silently gone", async () => {
		const client = new FakeClient(manifest([operation("tasks.create"), operation("docs.list")]));
		const h = createExtensionHarness(shellStyleFactory(client));
		await h.boot();

		expect(h.tools.has("tools_list")).toBe(true);
		expect(h.tools.has("tools_man")).toBe(true);
		expect(h.tools.has("tools_type")).toBe(true);

		await h.reload();

		expect(h.tools.has("tools_list")).toBe(true);
		expect(h.tools.has("tools_man")).toBe(true);
		expect(h.tools.has("tools_type")).toBe(true);

		// Not just "registered" -- genuinely callable, returning real data, against the fresh
		// post-reload ExtensionAPI instance.
		const result = (await h.invokeTool("tools_list", {})) as { content: Array<{ text: string }> };
		expect(result.content[0]?.text).toContain("test-vehicle:docs.list");
	});

	it("the tool_execution_end/turn_end event wiring is re-armed too, not just tool registration -- a call after reload is still tracked", async () => {
		const client = new FakeClient(manifest([operation("tasks.create"), operation("docs.list")]));
		const h = createExtensionHarness(shellStyleFactory(client));
		await h.boot();
		await h.reload();

		// tools_man activates docs.list; if tool_execution_end's own recordCall wiring survived
		// the reload, calling the newly-activated tool marks it active and tracked -- if the
		// listener silently vanished (the bug this test guards against), the tool would still
		// technically exist post-reload but its usage would never reach the tracker at all.
		await h.invokeTool("tools_man", { names: ["test-vehicle:docs.list"] });
		await h.emit("tool_execution_end", { toolName: "docs_list" });

		// turn_end re-applies activation from the tracker's own live state -- if it never fired
		// (the other half of the same bug), this call itself would reject rather than settling
		// cleanly, failing the test.
		await h.emit("turn_end", {});
		expect(h.activeTools).toContain("docs_list");
	});
});

describe("Vehicle Shell meta-tools report their own usage to the relevant vehicle(s), server-side (no client-side storage)", () => {
	it("tools_list reports to every discovered vehicle, with the real callerSessionId/callerProjectRoot and outcome: success", async () => {
		const { pi, tools } = fakePi();
		const client = new SpyClient(manifest([operation("tasks.create")]));
		await registerVehicleTools(pi, client, { shell: {} });

		await callToolWithContext(tools, "tools_list", {}, "session-42", "/home/x/project");
		await flushBackgroundReporting();

		const reports = client.invocations.filter((call) => call.name === "metrics.recordClientEvent");
		expect(reports).toHaveLength(1);
		expect(reports[0]?.input).toEqual({
			toolName: "tools_list",
			outcome: "success",
			durationMs: expect.any(Number),
			callerSessionId: "session-42",
			callerProjectRoot: "/home/x/project",
		});
	});

	it("tools_list still returns its own real result even when the target vehicle's metrics.recordClientEvent call rejects", async () => {
		class ThrowingMetricsClient extends FakeClient {
			override async invoke<Output = unknown>(name: string, version: number, input: unknown, options?: VehicleInvocationOptions): Promise<Output> {
				if (name === "metrics.recordClientEvent") throw new Error("daemon unreachable");
				return super.invoke(name, version, input, options);
			}
		}
		const { pi, tools } = fakePi();
		await registerVehicleTools(pi, new ThrowingMetricsClient(manifest([operation("tasks.create")])), { shell: {} });

		const result = (await callTool(tools, "tools_list", {})) as { content: Array<{ text: string }> };
		expect(result.content[0]?.text).toContain("tasks.create");
	});

	it("tools_man reports once per distinct vehicle actually touched, not once per requested name", async () => {
		const { pi, tools } = fakePi();
		const client = new SpyClient(manifest([operation("tasks.create"), operation("tasks.depend")]));
		await registerVehicleTools(pi, client, { shell: {} });

		await callToolWithContext(tools, "tools_man", { names: ["test-vehicle:tasks.create", "test-vehicle:tasks.depend"] }, "session-1", "/x");

		const reports = client.invocations.filter((call) => call.name === "metrics.recordClientEvent");
		expect(reports).toHaveLength(1); // both names resolve to the same one vehicle
		expect(reports[0]?.input).toMatchObject({ toolName: "tools_man", outcome: "success" });
	});

	it("tools_man reports nothing when every requested name is unknown -- no vehicle was actually touched", async () => {
		const { pi, tools } = fakePi();
		const client = new SpyClient(manifest([operation("tasks.create")]));
		await registerVehicleTools(pi, client, { shell: {} });

		await callTool(tools, "tools_man", { names: ["nonexistent.operation"] });

		expect(client.invocations.filter((call) => call.name === "metrics.recordClientEvent")).toHaveLength(0);
	});

	it("tools_type reports once per distinct vehicle actually touched, read-only (never activates anything)", async () => {
		const { pi, tools } = fakePi();
		const client = new SpyClient(manifest([operation("tasks.create")]));
		await registerVehicleTools(pi, client, { shell: {} });

		await callToolWithContext(tools, "tools_type", { names: ["test-vehicle:tasks.create"] }, "session-9", "/x");

		const reports = client.invocations.filter((call) => call.name === "metrics.recordClientEvent");
		expect(reports).toHaveLength(1);
		expect(reports[0]?.input).toMatchObject({ toolName: "tools_type", outcome: "success" });
	});

	it("tools_type reports nothing for a completely unknown name", async () => {
		const { pi, tools } = fakePi();
		const client = new SpyClient(manifest([operation("tasks.create")]));
		await registerVehicleTools(pi, client, { shell: {} });

		await callTool(tools, "tools_type", { names: ["nonexistent.operation"] });

		expect(client.invocations.filter((call) => call.name === "metrics.recordClientEvent")).toHaveLength(0);
	});

	it("works with no sessionManager/cwd at all in context (a minimal test double, or a real host that hasn't supplied one) -- reports with undefined session fields rather than throwing", async () => {
		const { pi, tools } = fakePi();
		const client = new SpyClient(manifest([operation("tasks.create")]));
		await registerVehicleTools(pi, client, { shell: {} });

		const result = (await callTool(tools, "tools_list", {})) as { content: Array<{ text: string }> };
		await flushBackgroundReporting();
		expect(result.content[0]?.text).toContain("tasks.create");
		const reports = client.invocations.filter((call) => call.name === "metrics.recordClientEvent");
		expect(reports).toHaveLength(1);
		expect(reports[0]?.input).toMatchObject({ toolName: "tools_list", callerSessionId: undefined, callerProjectRoot: undefined });
	});

	it("survives ctx itself being undefined -- a stricter case than a defined ctx missing sessionManager/cwd (some hand-rolled test harnesses across the ecosystem pass no 5th arg at all)", async () => {
		const { pi, tools } = fakePi();
		const client = new SpyClient(manifest([operation("tasks.create")]));
		await registerVehicleTools(pi, client, { shell: {} });

		const tool = tools.find((t) => t.name === "tools_list");
		if (!tool) throw new Error("tools_list not registered");
		const result = (await tool.execute("call-1", {} as never, undefined as never, undefined as never, undefined as never)) as {
			content: Array<{ text: string }>;
		};
		await flushBackgroundReporting();
		expect(result.content[0]?.text).toContain("tasks.create");
		const reports = client.invocations.filter((call) => call.name === "metrics.recordClientEvent");
		expect(reports).toHaveLength(1);
		expect(reports[0]?.input).toMatchObject({ toolName: "tools_list", callerSessionId: undefined, callerProjectRoot: undefined });
	});
});
