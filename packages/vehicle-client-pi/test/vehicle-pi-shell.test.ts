import { describe, expect, it } from "bun:test";
import { createExtensionHarness } from "@danypops/pi-extension-harness";
import type { VehicleClient, VehicleInvocationOptions, VehicleManifest, VehicleManifestOperation } from "@danypops/vehicle-core";
import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { refreshVehicleToolAvailability, registerVehicleTools } from "../src/vehicle-pi.ts";
import { registerVehicleShell } from "../src/vehicle-shell.ts";

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

function manifest(operations: readonly VehicleManifestOperation[]): VehicleManifest {
	return { name: "test-vehicle", version: "1.0.0", description: "Test Vehicle.", operations };
}

function discoveredVehicle(name: string, operations: readonly VehicleManifestOperation[]) {
	const vehicleManifest = { name, version: "1.0.0", description: `${name} Vehicle.`, operations };
	return { name, manifest: vehicleManifest, client: new FakeClient(vehicleManifest) };
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

function fakePi() {
	const tools: ToolDefinition[] = [];
	const harness = createExtensionHarness(() => {});
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

		expect(harness.activeTools.sort()).toEqual(["tasks_create", "tools_list", "tools_man"].sort());
	});

	it("tools_list returns every operation as a one-liner, without activating any of them", async () => {
		const { pi, tools, harness } = fakePi();
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create"), operation("docs.list")])), { shell: {} });

		const result = (await callTool(tools, "tools_list", {})) as { content: Array<{ text: string }> };
		expect(result.content[0]?.text).toContain("tasks.create -- Run tasks.create.");
		expect(result.content[0]?.text).toContain("docs.list -- Run docs.list.");
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
			expect(result.content[0]?.text.split("\n")[0]).toStartWith("tasks.create --");
		}
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

		const result = (await callTool(tools, "tools_man", { names: ["tasks.create"] })) as { content: Array<{ text: string }> };
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

		const result = (await callTool(tools, "tools_man", { names: ["tasks.depend"] })) as { content: Array<{ text: string }> };
		expect(result.content[0]?.text).toContain("tasks_depend (tasks.depend, v1)");
		expect(result.content[0]?.text).toContain("now callable as tasks_depend");
		expect(harness.activeTools).toContain("tasks_depend");
	});

	it("tools_man allows skip-ahead -- a name never surfaced by tools_list still activates", async () => {
		const { pi, tools, harness } = fakePi();
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.depend"), operation("docs.list")])), { shell: {} });

		await callTool(tools, "tools_man", { names: ["docs.list"] });
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
		await callTool(tools, "tools_man", { names: ["tasks.depend"] });
		expect(harness.activeTools).toContain("tasks_depend");

		await harness.emit("turn_end", { turnIndex: 0, message: {}, toolResults: [] });
		expect(harness.activeTools).toContain("tasks_depend"); // 2 -> 1, still alive

		await harness.emit("turn_end", { turnIndex: 1, message: {}, toolResults: [] });
		expect(harness.activeTools).not.toContain("tasks_depend"); // 1 -> 0, evicted
	});

	it("calling a discovered operation resets its TTL instead of letting it decay while in use", async () => {
		const { pi, tools, harness } = fakePi();
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.depend")])), { shell: { discoveredTtlTurns: 2 } });
		await callTool(tools, "tools_man", { names: ["tasks.depend"] });

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

		const result = (await callTool(tools, "tools_man", { names: ["tasks.depend"] })) as { content: Array<{ text: string }> };
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
		await callTool(tools, "tools_man", { names: ["tasks.depend"] });

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

describe("registerVehicleTools with shell broker mode", () => {
	it("without options.shell.broker, tools_list is unaffected -- today's exact single-vehicle behavior", async () => {
		const { pi, tools } = fakePi();
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create")])), { shell: {} });

		const result = (await callTool(tools, "tools_list", {})) as { content: Array<{ text: string }> };
		expect(result.content[0]?.text).toBe("tasks.create -- Run tasks.create.");
	});

	it("tools_list merges a broker-discovered foreign vehicle's operations, namespaced by vehicle name", async () => {
		const { pi, tools } = fakePi();
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create")])), {
			shell: {
				broker: {
					ownVehicleName: "papyrus",
					discover: async () => [discoveredVehicle("packed", [operation("package.install")])],
				},
			},
		});

		const result = (await callTool(tools, "tools_list", {})) as { content: Array<{ text: string }> };
		expect(result.content[0]?.text).toContain("tasks.create -- Run tasks.create.");
		expect(result.content[0]?.text).toContain("packed:package.install -- Run package.install.");
	});

	it("tools_list's query filter matches a namespaced foreign operation's own name", async () => {
		const { pi, tools } = fakePi();
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create")])), {
			shell: {
				broker: {
					ownVehicleName: "papyrus",
					discover: async () => [discoveredVehicle("packed", [operation("package.install")])],
				},
			},
		});

		const result = (await callTool(tools, "tools_list", { query: "package" })) as { content: Array<{ text: string }> };
		expect(result.content[0]?.text).toBe("packed:package.install -- Run package.install.");
	});

	it("broker discovery throwing never breaks tools_list's own base (local) listing", async () => {
		const { pi, tools } = fakePi();
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create")])), {
			shell: {
				broker: {
					ownVehicleName: "papyrus",
					discover: async () => {
						throw new Error("handle directory unreadable");
					},
				},
			},
		});

		const result = (await callTool(tools, "tools_list", {})) as { content: Array<{ text: string }> };
		expect(result.content[0]?.text).toBe("tasks.create -- Run tasks.create.");
	});

	it("tools_man for a known local operation is unaffected by broker mode", async () => {
		const { pi, tools, harness } = fakePi();
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create")])), {
			shell: { broker: { ownVehicleName: "papyrus", discover: async () => [] } },
		});

		const result = (await callTool(tools, "tools_man", { names: ["tasks.create"] })) as { content: Array<{ text: string }> };
		expect(result.content[0]?.text).toContain("now callable as tasks_create");
		expect(harness.activeTools).toContain("tasks_create");
	});

	// registerVehicleTools always auto-supplies activateForeignOperation now (see the real-routing
	// tests below) -- this fallback message is only reachable by a consumer calling
	// registerVehicleShell directly without one, e.g. a future consumer that wants broker-mode
	// discovery/listing without dynamic foreign-tool activation.
	it("tools_man for a broker-discovered foreign operation reports it as known but not yet locally activatable when no activateForeignOperation hook is given", async () => {
		const { pi, tools, harness } = fakePi();
		registerVehicleShell(pi, manifest([operation("tasks.create")]), [], {
			broker: {
				ownVehicleName: "papyrus",
				discover: async () => [discoveredVehicle("packed", [operation("package.install")])],
			},
		});

		const result = (await callTool(tools, "tools_man", { names: ["packed:package.install"] })) as { content: Array<{ text: string }> };
		expect(result.content[0]?.text).toContain('known -- provided by Vehicle "packed"');
		expect(result.content[0]?.text).toContain("not yet callable here");
		expect(harness.activeTools).not.toContain("packed:package.install");
	});

	it("tools_man for a name that's neither local nor broker-discoverable keeps today's exact unknown-operation message", async () => {
		const { pi, tools } = fakePi();
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create")])), {
			shell: { broker: { ownVehicleName: "papyrus", discover: async () => [] } },
		});

		const result = (await callTool(tools, "tools_man", { names: ["nonexistent.operation"] })) as { content: Array<{ text: string }> };
		expect(result.content[0]?.text).toBe("nonexistent.operation: no such operation. Use tools_list to browse available names.");
	});

	it("tools_man for a broker-discovered operation dynamically routes to and registers a real, callable Pi tool via activateForeignOperation", async () => {
		const { pi, tools, harness } = fakePi();
		const vehicle = discoveredVehicle("packed", [operation("package.install")]);
		const activated: Array<{ vehicleName: string; operationName: string }> = [];
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create")])), {
			shell: {
				broker: {
					ownVehicleName: "papyrus",
					discover: async () => [vehicle],
					activateForeignOperation: (v, descriptor) => {
						activated.push({ vehicleName: v.name, operationName: descriptor.name });
						const toolName = `${v.name}_${descriptor.name.replace(/\./g, "_")}`;
						pi.registerTool({
							name: toolName,
							label: descriptor.name,
							description: descriptor.description,
							parameters: descriptor.inputSchema as never,
							async execute() {
								return { content: [{ type: "text", text: "ok" }], details: {} };
							},
						});
						return toolName;
					},
				},
			},
		});

		const result = (await callTool(tools, "tools_man", { names: ["packed:package.install"] })) as { content: Array<{ text: string }> };
		expect(activated).toEqual([{ vehicleName: "packed", operationName: "package.install" }]);
		expect(result.content[0]?.text).toContain("now callable as packed_package_install");
		expect(harness.activeTools).toContain("packed_package_install");

		// A second tools_man call on the same foreign operation must not re-activate it.
		await callTool(tools, "tools_man", { names: ["packed:package.install"] });
		expect(activated.length).toBe(1);
	});

	it("by default (no explicit activateForeignOperation), registerVehicleTools wires real routing: the activated foreign tool actually invokes the foreign vehicle's own client, and decays via the same TTL cycle as any local tool", async () => {
		const { pi, tools, harness } = fakePi();
		const foreignManifest = manifest([
			operation("package.install", { inputSchema: { type: "object", properties: { name: { type: "string" } } } }),
		]);
		const invocations: Array<{ name: string; version: number; input: unknown }> = [];
		class RecordingClient extends FakeClient {
			override async invoke<Output = unknown>(name: string, version: number, input: unknown): Promise<Output> {
				invocations.push({ name, version, input });
				return { installed: true } as Output;
			}
		}
		const vehicle = { name: "packed", manifest: foreignManifest, client: new RecordingClient(foreignManifest) };

		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create")])), {
			shell: { broker: { ownVehicleName: "papyrus", discover: async () => [vehicle] } },
		});

		await callTool(tools, "tools_man", { names: ["packed:package.install"] });
		expect(harness.activeTools).toContain("packed_package_install");

		const installTool = tools.find((tool) => tool.name === "packed_package_install");
		if (!installTool) throw new Error("packed_package_install not registered");
		const result = (await installTool.execute(
			"call-1",
			{ name: "curl" } as never,
			undefined as never,
			undefined as never,
			{
				sessionManager: { getSessionId: () => "session-1" },
				hasUI: false,
			} as never,
		)) as { content: Array<{ text: string }> };
		expect(invocations).toEqual([{ name: "package.install", version: 1, input: { name: "curl" } }]);
		expect(result.content[0]?.text).toContain("installed");

		// Same decay cycle as any locally-registered discovered operation (default discoveredTtlTurns=8).
		for (let turn = 0; turn < 8; turn++) {
			await harness.emit("turn_end", { turnIndex: turn, message: {}, toolResults: [] });
		}
		expect(harness.activeTools).not.toContain("packed_package_install");
	});

	it("activateForeignOperation throwing (e.g. a Pi tool-name collision) reports a friendly failure without crashing tools_man", async () => {
		const { pi, tools } = fakePi();
		const vehicle = discoveredVehicle("packed", [operation("package.install")]);
		await registerVehicleTools(pi, new FakeClient(manifest([operation("tasks.create")])), {
			shell: {
				broker: {
					ownVehicleName: "papyrus",
					discover: async () => [vehicle],
					activateForeignOperation: () => {
						throw new Error("Pi tool 'packed_package_install' is already registered");
					},
				},
			},
		});

		const result = (await callTool(tools, "tools_man", { names: ["packed:package.install"] })) as { content: Array<{ text: string }> };
		expect(result.content[0]?.text).toBe(
			"packed:package.install: could not activate -- Pi tool 'packed_package_install' is already registered.",
		);
	});
});
