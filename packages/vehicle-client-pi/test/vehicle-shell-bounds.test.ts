import { afterEach, beforeEach, expect, it, spyOn } from "bun:test";
import { createExtensionHarness } from "@danypops/pi-extension-harness";
import { registerVehicleTools } from "../src/vehicle-pi.ts";
import { __resetVehicleShellHandleForTests } from "../src/vehicle-shell.ts";
import * as broker from "../src/vehicle-shell-broker.ts";
import { __resetInProcessVehicleRegistryForTests } from "../src/vehicle-shell-registry.ts";
import { efficiencyCatalog, SyntheticCatalogClient } from "./fixtures/shell-efficiency.ts";

let harness: ReturnType<typeof createExtensionHarness>;
let discovery: ReturnType<typeof spyOn<typeof broker, "discoverForeignVehicles">>;
let clients: SyntheticCatalogClient[];
beforeEach(async () => {
	__resetVehicleShellHandleForTests();
	__resetInProcessVehicleRegistryForTests();
	discovery = spyOn(broker, "discoverForeignVehicles").mockResolvedValue([]);
	harness = createExtensionHarness(() => {});
	clients = efficiencyCatalog().map((manifest) => new SyntheticCatalogClient(manifest));
	for (const client of clients)
		await registerVehicleTools(harness.api, client, {
			toolName: (op) => `${client.value.name}_${op.name.replaceAll(".", "_")}`,
			shell: { coreOperations: [], toolboxReminder: { enabled: false } },
		});
	await harness.boot();
});
afterEach(async () => {
	await new Promise<void>((resolve) => setImmediate(resolve));
	await harness.shutdown();
	discovery.mockRestore();
	__resetVehicleShellHandleForTests();
	__resetInProcessVehicleRegistryForTests();
});

type Result = {
	content: { text: string }[];
	isError?: boolean;
	details: {
		operations: { name: string }[];
		nextCursor?: string;
		truncated: boolean;
		total: number;
		code?: string;
	};
};
const call = async (tool: string, args: Record<string, unknown>): Promise<Result> => (await harness.invokeTool(tool, args)) as Result;

it("pages a large inventory to exact completion", async () => {
	const client = clients[0];
	const op = client?.value.operations[0];
	if (!client || !op) throw new Error("missing fixture");
	client.value = { ...client.value, operations: Array.from({ length: 240 }, (_, i) => ({ ...op, name: `records.read${i}` })) };
	const names: string[] = [];
	let cursor: string | undefined;
	for (let page = 0; page < 12; page++) {
		const result = await call("tools_list", { cursor });
		expect(result.isError).not.toBe(true);
		expect(result.details.operations.length).toBeLessThanOrEqual(50);
		expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(16_384);
		names.push(...result.details.operations.map((row) => row.name));
		cursor = result.details.nextCursor;
		if (!cursor) break;
	}
	expect(cursor).toBeUndefined();
	expect(names).toEqual(clients.flatMap((entry) => entry.value.operations.map((operation) => `${entry.value.name}:${operation.name}`)));
	expect(new Set(names).size).toBe(252);
});

it.each(["🔎".repeat(256), '\\"'.repeat(512), "(".repeat(512)])("bounds empty and invalid-regex diagnostics", async (query) => {
	for (const mode of ["substring", "regex"]) {
		const result = await call("tools_list", { query, mode, maxBytes: 1_024 });
		expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(1_024);
	}
});

it("bounds ambiguous status results and permits a narrower retry", async () => {
	const manifest = efficiencyCatalog()[0];
	if (!manifest) throw new Error("missing fixture");
	discovery.mockResolvedValue(
		Array.from({ length: 80 }, (_, index) => {
			const value = { ...manifest, name: `${"remote".repeat(9)}${index}` };
			return { name: value.name, manifest: value, client: new SyntheticCatalogClient(value) };
		}),
	);
	const result = await call("tools_type", { names: Array(16).fill("records.read00") });
	expect(result.details.code).toBe("output-budget-exceeded");
	expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(65_536);
	const retry = await call("tools_type", { names: ["records.read00"] });
	expect(retry.isError).not.toBe(true);
	expect(Buffer.byteLength(JSON.stringify(retry))).toBeLessThanOrEqual(65_536);
	expect(harness.activeTools).toHaveLength(3);
});

it("bounds the maximum activation batch", async () => {
	for (const client of clients)
		client.value = { ...client.value, operations: client.value.operations.map((op) => ({ ...op, description: "\\u0000".repeat(20_000) })) };
	const names = clients.flatMap((client) => client.value.operations.map((op) => `${client.value.name}:${op.name}`)).slice(0, 16);
	const result = await call("tools_man", { names });
	expect(result.details.truncated).toBe(true);
	expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(65_536);
	expect(harness.activeTools).toHaveLength(19);
});

it("pages filtered identities under the full response budget", async () => {
	const actual: string[] = [];
	let cursor: string | undefined;
	for (let page = 0; page < 6; page++) {
		const result = await call("tools_list", { vehicle: "alpha", namespace: "records", limit: 2, maxBytes: 1_024, cursor });
		expect(result.isError).not.toBe(true);
		expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(1_024);
		expect(result.details.total).toBe(6);
		actual.push(...result.details.operations.map((op) => op.name));
		cursor = result.details.nextCursor;
		if (!cursor) break;
		expect(result.details.truncated).toBe(true);
	}
	expect(cursor).toBeUndefined();
	expect(actual).toEqual([0, 2, 4, 6, 8, 10].map((i) => `alpha:records.read${String(i).padStart(2, "0")}`));
	expect(harness.activeTools).toHaveLength(3);
});

it("rejects stale and filter-mismatched cursors", async () => {
	const first = await call("tools_list", { limit: 1 });
	expect(first.details.nextCursor).toBeString();
	const changed = await call("tools_list", { limit: 1, query: "records", cursor: first.details.nextCursor });
	expect(changed.details.code).toBe("stale-cursor");
	const client = clients[0];
	if (!client) throw new Error("missing fixture");
	client.value = { ...client.value, operations: client.value.operations.slice(1) };
	expect((await call("tools_list", { cursor: first.details.nextCursor })).details.code).toBe("stale-cursor");
});

it.each([
	["tools_list", { limit: 0 }],
	["tools_list", { maxBytes: 65_537 }],
	["tools_list", { query: "x".repeat(513) }],
	["tools_list", { cursor: "invalid" }],
	["tools_man", { names: Array(17).fill("alpha:records.read00") }],
	["tools_type", { names: ["x".repeat(257)] }],
] as const)("rejects invalid input for %s", async (tool, args) => {
	const active = [...harness.activeTools];
	const result = await call(tool, args);
	expect(result.isError).toBe(true);
	expect(result.details.code).toBe("invalid-input");
	expect(harness.activeTools).toEqual(active);
});

it("bounds oversized manual text and preserves activation status", async () => {
	const client = clients[0];
	const op = client?.value.operations[0];
	if (!client || !op) throw new Error("missing fixture");
	client.value = { ...client.value, operations: [{ ...op, description: '🔎"\\'.repeat(30_000) }, ...client.value.operations.slice(1)] };
	const result = await call("tools_man", { names: ["alpha:records.read00"] });
	expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(65_536);
	expect(result.details.truncated).toBe(true);
	expect(result.content[0]?.text).toContain("now callable as alpha_records_read00");
	expect(harness.activeTools).toContain("alpha_records_read00");
});

it("bounds oversized discovery rows with visible incompleteness", async () => {
	const client = clients[0];
	const op = client?.value.operations[0];
	if (!client || !op) throw new Error("missing fixture");
	client.value = { ...client.value, operations: [{ ...op, description: '🔎"\\'.repeat(30_000) }, ...client.value.operations.slice(1)] };
	const result = await call("tools_list", { vehicle: "alpha", limit: 1, maxBytes: 1_024 });
	expect(result.details.operations).toHaveLength(1);
	expect(result.details.truncated).toBe(true);
	expect(result.content[0]?.text).toContain("[summary truncated]");
	expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(1_024);
});
