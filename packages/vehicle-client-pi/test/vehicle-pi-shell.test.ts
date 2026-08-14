import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionHarness } from "@danypops/pi-extension-harness";
import type { VehicleClient, VehicleInvocationOptions, VehicleManifest, VehicleManifestOperation } from "@danypops/vehicle-core";
import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { refreshVehicleToolAvailability, registerVehicleTools } from "../src/vehicle-pi.ts";
import { __resetVehicleShellHandleForTests } from "../src/vehicle-shell.ts";
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
	constructor(public value: VehicleManifest) {}
	manifest(): Promise<VehicleManifest> {
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

	it("a discovered operation decays and is deactivated after its TTL elapses unused", async () => {
		const { pi, tools, harness } = fakePi();
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.depend")])), { shell: { discoveredTtlTurns: 2 } });
		await callTool(tools, "tools_man", { names: ["test-vehicle:tasks.depend"] });
		expect(harness.activeTools).toContain("tasks_depend");

		await harness.emit("turn_end", { turnIndex: 0, message: {}, toolResults: [] });
		expect(harness.activeTools).toContain("tasks_depend"); // 2 -> 1, still alive

		await harness.emit("turn_end", { turnIndex: 1, message: {}, toolResults: [] });
		expect(harness.activeTools).not.toContain("tasks_depend"); // 1 -> 0, evicted
	});

	it("calling a discovered operation resets its TTL instead of letting it decay while in use", async () => {
		const { pi, tools, harness } = fakePi();
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.depend")])), { shell: { discoveredTtlTurns: 2 } });
		await callTool(tools, "tools_man", { names: ["test-vehicle:tasks.depend"] });

		await harness.emit("turn_end", { turnIndex: 0, message: {}, toolResults: [] }); // 2 -> 1
		await harness.emit("tool_execution_end", { toolCallId: "x", toolName: "tasks_depend", result: {}, isError: false });
		await harness.emit("turn_end", { turnIndex: 1, message: {}, toolResults: [] }); // called -> refreshed to 2

		await harness.emit("turn_end", { turnIndex: 2, message: {}, toolResults: [] }); // 2 -> 1
		expect(harness.activeTools).toContain("tasks_depend");
		await harness.emit("turn_end", { turnIndex: 3, message: {}, toolResults: [] }); // 1 -> 0
		expect(harness.activeTools).not.toContain("tasks_depend");
	});

	// Not permanently pinned.
	it("a core operation also decays and can be evicted if truly unused for long enough", async () => {
		const { pi, harness } = fakePi();
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create")])), {
			shell: { coreOperations: ["tasks.create"], coreTtlTurns: 1 },
		});
		expect(harness.activeTools).toContain("tasks_create");

		await harness.emit("turn_end", { turnIndex: 0, message: {}, toolResults: [] });
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
	it("refreshVehicleToolAvailability leaves an already-decaying discovered tool's TTL alone", async () => {
		const { pi, tools, harness } = fakePi();
		const client = new FakeClient(manifest([operation("tasks.depend")]));
		const registered = await registerVehicleTools(pi, client, { shell: { discoveredTtlTurns: 2 } });
		await callTool(tools, "tools_man", { names: ["test-vehicle:tasks.depend"] });

		await harness.emit("turn_end", { turnIndex: 0, message: {}, toolResults: [] }); // 2 -> 1
		await refreshVehicleToolAvailability(pi, client, registered, { shell: { discoveredTtlTurns: 2 } });
		expect(harness.activeTools).toContain("tasks_depend"); // refresh must not re-grant full TTL

		await harness.emit("turn_end", { turnIndex: 1, message: {}, toolResults: [] }); // 1 -> 0
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
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create")], "papyrus")), { shell: {} });

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

		// Same decay cycle as any other discovered operation (default discoveredTtlTurns=8).
		for (let turn = 0; turn < 8; turn++) {
			await harness.emit("turn_end", { turnIndex: turn, message: {}, toolResults: [] });
		}
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
		it("reports a core operation as active, with its real toolName and remaining TTL", async () => {
			const { pi, tools } = fakePi();
			await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create")], "papyrus")), {
				shell: { coreOperations: ["tasks.create"], coreTtlTurns: 20 },
			});

			const result = (await callTool(tools, "tools_type", { names: ["papyrus:tasks.create"] })) as { content: Array<{ text: string }> };
			expect(result.content[0]?.text).toBe(
				"papyrus:tasks.create: active -- callable now as tasks_create (20 turn(s) remaining before it decays).",
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
				shell: { discoveredTtlTurns: 2 },
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
