import { afterEach, beforeEach, expect, it, spyOn } from "bun:test";
import { createExtensionHarness } from "@danypops/pi-extension-harness";
import type { VehicleClient } from "@danypops/vehicle-core";
import { registerVehicleTools } from "../src/vehicle-pi.ts";
import { __resetVehicleShellHandleForTests } from "../src/vehicle-shell.ts";
import * as broker from "../src/vehicle-shell-broker.ts";
import { __resetInProcessVehicleRegistryForTests } from "../src/vehicle-shell-registry.ts";
import { efficiencyCatalog, SyntheticCatalogClient } from "./fixtures/shell-efficiency.ts";

let harness: ReturnType<typeof createExtensionHarness>;
let clients: VehicleClient[];
let discovery: ReturnType<typeof spyOn<typeof broker, "discoverForeignVehicles">>;
beforeEach(async () => {
	__resetVehicleShellHandleForTests();
	__resetInProcessVehicleRegistryForTests();
	discovery = spyOn(broker, "discoverForeignVehicles").mockResolvedValue([]);
	harness = createExtensionHarness(() => {});
	clients = [];
	for (const manifest of efficiencyCatalog()) {
		const client: VehicleClient = new SyntheticCatalogClient(manifest);
		clients.push(client);
		await registerVehicleTools(harness.api, client, {
			toolName: (op) => `${manifest.name}_${op.name.replaceAll(".", "_")}`,
			shell: { coreOperations: [], toolboxReminder: { enabled: false } },
		});
	}
	await harness.boot();
});
afterEach(async () => {
	await new Promise<void>((resolve) => setImmediate(resolve));
	await harness.shutdown();
	discovery.mockRestore();
	__resetVehicleShellHandleForTests();
	__resetInProcessVehicleRegistryForTests();
});

async function command(args: string) {
	await harness.invokeCommand("vehicle-tools", args);
	const sent = harness.sentMessages.at(-1);
	expect(sent?.options?.triggerTurn).toBe(false);
	expect(harness.userMessages).toHaveLength(0);
	return JSON.parse(String(sent?.message.content));
}

it.each([
	["list", { vehicle: "alpha", namespace: "records", limit: 2, maxBytes: 1024 }],
	["man", { names: ["alpha:records.read00"] }],
	["type", { names: ["alpha:records.read00", "records.read00", "absent"] }],
	["man", { names: ["records.read00", "absent"] }],
	["list", { limit: 0 }],
	["man", { names: Array(17).fill("alpha:records.read00") }],
] as const)("matches native %s results", async (action, input) => {
	const actual = await command(`${action} --json ${JSON.stringify(input)}`);
	const expected = await harness.invokeTool(`tools_${action}`, input);
	expect(actual).toEqual(JSON.parse(JSON.stringify(expected)));
});

it("shares activation state with the native tools", async () => {
	expect(harness.commands.filter((name) => name === "vehicle-tools")).toHaveLength(1);
	expect(harness.activeTools).not.toContain("alpha_records_read00");
	await command('man --json {"names":["alpha:records.read00"]}');
	expect(harness.activeTools).toContain("alpha_records_read00");
	const status = await command('type --json {"names":["alpha:records.read00"]}');
	expect(status.details.results[0].status).toBe("active");
});

it.each(["list --json {", "unknown --json {}", `list --json ${" ".repeat(8192)}`])("rejects malformed commands", async (args) => {
	const before = [...harness.activeTools];
	const result = await command(args);
	expect(result.isError).toBe(true);
	expect(result.details.code).toBe("invalid-input");
	expect(harness.activeTools).toEqual(before);
});

it("documents session scope and derives help from tool schemas", async () => {
	const help = await command("help --json");
	expect(help.details.scope).toBe("pi-session");
	for (const action of ["list", "man", "type"]) {
		expect(help.details.operations[action].parameters).toEqual(
			JSON.parse(JSON.stringify(harness.tools.get(`tools_${action}`)?.definition.parameters)),
		);
	}
});

it("recognizes JSON mode after padded whitespace", async () => {
	const result = await command(`list${" ".repeat(80)}--json {"limit":1}`);
	expect(result.details.operations).toHaveLength(1);
});

it("renders human content through Pi", async () => {
	const expected = (await harness.invokeTool("tools_list", { query: "absent" })) as { content: unknown };
	await harness.invokeCommand("vehicle-tools", 'list {"query":"absent"}');
	expect(harness.sentMessages.at(-1)?.message.content).toEqual(expected.content);
	expect(harness.leaks).toHaveLength(0);
});

it("cancels pending activation on session shutdown", async () => {
	let enter!: () => void;
	const entered = new Promise<void>((resolve) => {
		enter = resolve;
	});
	let release!: () => void;
	const waiting = new Promise<void>((resolve) => {
		release = resolve;
	});
	discovery.mockImplementation(async () => {
		enter();
		await waiting;
		return [];
	});
	const pending = harness.invokeCommand("vehicle-tools", 'man --json {"names":["alpha:records.read00"]}');
	await entered;
	await harness.emit("session_shutdown", { reason: "reload" });
	release();
	await pending;
	expect(harness.activeTools).not.toContain("alpha_records_read00");
	expect(harness.sentMessages).toHaveLength(0);
});

it("isolates results across session replacement", async () => {
	let enter!: () => void;
	const entered = new Promise<void>((resolve) => {
		enter = resolve;
	});
	let release!: () => void;
	const waiting = new Promise<void>((resolve) => {
		release = resolve;
	});
	discovery.mockImplementation(async () => {
		enter();
		await waiting;
		return [];
	});
	const pending = harness.invokeCommand("vehicle-tools", 'man --json {"names":["alpha:records.read00"]}');
	await entered;
	await harness.emit("session_shutdown", {});
	await harness.emit("session_start", {});
	discovery.mockResolvedValue([]);
	await command('list --json {"limit":1}');
	expect(harness.sentMessages).toHaveLength(1);
	release();
	await pending;
	expect(harness.sentMessages).toHaveLength(1);
	expect(harness.activeTools).not.toContain("alpha_records_read00");
});

it("rejects concurrent commands rather than queuing", async () => {
	let enter!: () => void;
	const entered = new Promise<void>((resolve) => {
		enter = resolve;
	});
	let release!: () => void;
	const waiting = new Promise<void>((resolve) => {
		release = resolve;
	});
	discovery.mockImplementation(async () => {
		enter();
		await waiting;
		return [];
	});
	const pending = harness.invokeCommand("vehicle-tools", 'man --json {"names":["alpha:records.read00"]}');
	await entered;
	const result = await command('man --json {"names":["beta:records.read00"]}');
	expect(result.details.code).toBe("shell-busy");
	release();
	await pending;
	expect(harness.activeTools).not.toContain("beta_records_read00");
});

it("rebinds the command on reload", async () => {
	await harness.reload();
	const manifest = efficiencyCatalog()[0];
	if (!manifest) throw new Error("missing fixture");
	await registerVehicleTools(harness.api, new SyntheticCatalogClient(manifest), { shell: { coreOperations: [] } });
	expect(harness.commands.filter((name) => name === "vehicle-tools")).toHaveLength(1);
	const result = await command('list --json {"vehicle":"alpha","limit":1}');
	expect(result.details.operations).toHaveLength(1);
});

it("refuses unavailable operations", async () => {
	const manifest = efficiencyCatalog()[0];
	if (!manifest) throw new Error("missing fixture");
	const unavailable = { ...manifest, name: "unavailable", operations: manifest.operations.map((op) => ({ ...op, available: false })) };
	await registerVehicleTools(harness.api, new SyntheticCatalogClient(unavailable), {
		toolName: (op) => `unavailable_${op.name.replaceAll(".", "_")}`,
		shell: { coreOperations: [] },
	});
	const input = { names: ["unavailable:records.read00"] };
	const result = await command(`man --json ${JSON.stringify(input)}`);
	expect(result).toEqual(JSON.parse(JSON.stringify(await harness.invokeTool("tools_man", input))));
	expect(harness.activeTools).not.toContain("unavailable_records_read00");
});

it("preserves caller identity in authenticated client invocations", async () => {
	const client = clients[0];
	if (!client) throw new Error("missing fixture");
	const invoke = spyOn(client, "invoke");
	await command('list --json {"limit":1}');
	await new Promise<void>((resolve) => setImmediate(resolve));
	expect(invoke.mock.calls).toHaveLength(1);
	expect(invoke.mock.calls[0]?.[0]).toBe("metrics.recordClientEvent");
	expect(invoke.mock.calls[0]?.[3]).toMatchObject({
		callerSessionId: harness.ctx.sessionManager.getSessionId(),
		callerProjectRoot: harness.ctx.cwd,
		permissions: ["vehicle:metrics:record-client-event"],
	});
	invoke.mockRestore();
});

it("keeps permission-blocked operations inactive", async () => {
	const manifest = efficiencyCatalog()[0];
	if (!manifest) throw new Error("missing fixture");
	const restricted = {
		...manifest,
		name: "restricted",
		operations: manifest.operations.map((op) => ({ ...op, permissions: ["restricted:read"] })),
	};
	await registerVehicleTools(harness.api, new SyntheticCatalogClient(restricted), {
		permissions: [],
		toolName: (op) => `restricted_${op.name.replaceAll(".", "_")}`,
		shell: { coreOperations: [] },
	});
	const result = await command('man --json {"names":["restricted:records.read00"]}');
	expect(result.content[0].text).toContain("blocked by the current safety policy");
	expect(harness.activeTools).not.toContain("restricted_records_read00");
});

it("refuses activation while the agent is busy", async () => {
	harness.ctx.isIdle = () => false;
	const result = await command('man --json {"names":["alpha:records.read00"]}');
	expect(result.details.code).toBe("shell-busy");
	expect(harness.activeTools).not.toContain("alpha_records_read00");
});
