import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { createHash } from "node:crypto";
import { createExtensionHarness } from "@danypops/pi-extension-harness";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { registerVehicleTools } from "../src/vehicle-pi.ts";
import { __resetVehicleShellHandleForTests } from "../src/vehicle-shell.ts";
import * as broker from "../src/vehicle-shell-broker.ts";
import { __resetInProcessVehicleRegistryForTests } from "../src/vehicle-shell-registry.ts";
import { efficiencyCatalog, measureExposure, SyntheticCatalogClient } from "./fixtures/shell-efficiency.ts";
import { shellExposureControl } from "./fixtures/shell-exposure-control.ts";

const harnesses: ReturnType<typeof createExtensionHarness>[] = [];
let discovery: ReturnType<typeof spyOn<typeof broker, "discoverForeignVehicles">>;

beforeEach(() => {
	__resetVehicleShellHandleForTests();
	__resetInProcessVehicleRegistryForTests();
	discovery = spyOn(broker, "discoverForeignVehicles").mockResolvedValue([]);
});

afterEach(async () => {
	for (const harness of harnesses.splice(0)) await harness.shutdown();
	discovery.mockRestore();
	__resetVehicleShellHandleForTests();
	__resetInProcessVehicleRegistryForTests();
});

async function setup(aggregateCacheTtlMs: number) {
	const harness = createExtensionHarness(() => {});
	harnesses.push(harness);
	const clients = efficiencyCatalog().map((manifest) => new SyntheticCatalogClient(manifest));
	for (const client of clients) {
		await registerVehicleTools(harness.api, client, {
			toolName: (op) => `${client.value.name}_${op.name.replaceAll(".", "_")}`,
			shell: { coreOperations: [], aggregateCacheTtlMs, toolboxReminder: { enabled: false } },
		});
	}
	await harness.boot();
	for (const client of clients) client.manifestCalls = 0;
	return { harness, clients };
}

function digest(names: readonly string[]): string {
	return createHash("sha256").update(JSON.stringify(names)).digest("hex");
}

function resultOf(value: unknown) {
	return value as { content: { type: "text"; text: string }[]; details: { operations?: { name: string }[] } };
}

describe("shell exposure controls", () => {
	it.each([0, 60_000].flatMap((ttl) => ["", "records", "absent"].map((query) => ({ ttl, query }))))(
		"preserves cold/warm discovery: %j",
		async ({ ttl, query }) => {
			const { harness, clients } = await setup(ttl);
			const expected = efficiencyCatalog().flatMap((catalog) => catalog.operations.map((op) => `${catalog.name}:${op.name}`));
			const definitions = () => harness.activeTools.map((name) => harness.tools.get(name)?.definition as ToolDefinition);
			const initial = [...harness.activeTools];
			const names = expected.filter((name) => name.includes(query));
			const samples = [];
			for (const phase of ["cold", "warm"] as const) {
				const before = clients.reduce((total, client) => total + client.manifestCalls, 0);
				const result = resultOf(await harness.invokeTool("tools_list", { query }));
				const actual = result.details.operations?.map((op) => op.name) ?? [];
				expect(actual).toEqual(names);
				for (const name of names) expect(result.content[0]?.text).toContain(`${name} --`);
				const sample = measureExposure(definitions(), result.content, actual);
				expect(sample.operationDigest).toBe(digest(names));
				expect(sample.providerUsage).toBeNull();
				expect(sample.resultUtf8Bytes).toBeGreaterThan(0);
				expect(sample.schemaUtf8Bytes).toBeLessThan(32_768);
				expect(JSON.stringify(sample).length).toBeLessThan(1_024);
				const control = shellExposureControl[(query || "all") as "all" | "records" | "absent"];
				expect(sample.operationDigest).toBe(control.operationDigest);
				expect(sample.schemaUtf8Bytes).toBeLessThanOrEqual(control.schemaUtf8Bytes);
				expect(sample.resultUtf8Bytes).toBeLessThanOrEqual(control.resultUtf8Bytes);
				expect(sample.estimatedSchemaTokens).toBeLessThanOrEqual(control.estimatedSchemaTokens);
				if (phase === "cold") expect(sample).toMatchSnapshot("bounded candidate");
				samples.push(sample);
				const calls = clients.reduce((total, client) => total + client.manifestCalls, 0) - before;
				expect(calls).toBe(ttl === 0 || phase === "cold" ? 2 : 0);
			}
			expect(samples[0]).toEqual(samples[1]);
			await new Promise<void>((resolve) => setImmediate(resolve));
			expect(harness.activeTools).toEqual(initial);
			expect(clients.map((client) => client.telemetryCalls)).toEqual([2, 2]);
			expect(clients.every((client) => client.invocationCalls === 0)).toBe(true);
		},
	);

	it("activates only the requested identity on repeat", async () => {
		const { harness, clients } = await setup(60_000);
		const initial = [...harness.activeTools];
		const name = "alpha:records.read00";
		const samples = [];
		for (let repetition = 0; repetition < 2; repetition++) {
			const result = resultOf(await harness.invokeTool("tools_man", { names: [name] }));
			expect(harness.activeTools.filter((tool) => !initial.includes(tool))).toEqual(["alpha_records_read00"]);
			expect(result.content[0]?.text).toContain("now callable as alpha_records_read00");
			const definitions = harness.activeTools.map((tool) => harness.tools.get(tool)?.definition as ToolDefinition);
			samples.push(measureExposure(definitions, result.content, [name]));
		}
		expect(samples[0]).toEqual(samples[1]);
		expect(samples[0]?.operationDigest).toBe(shellExposureControl.activation.operationDigest);
		expect(samples[0]?.schemaUtf8Bytes).toBeLessThanOrEqual(shellExposureControl.activation.schemaUtf8Bytes);
		expect(samples[0]?.resultUtf8Bytes).toBeLessThanOrEqual(shellExposureControl.activation.resultUtf8Bytes);
		expect(samples[0]).toMatchSnapshot("bounded activation candidate");
		expect(clients.map((client) => client.telemetryCalls)).toEqual([2, 0]);
		expect(clients.map((client) => client.manifestCalls)).toEqual([2, 2]);
		expect(clients.every((client) => client.invocationCalls === 0)).toBe(true);
	});

	it("measures UTF-8 separately from estimated tokens", () => {
		const tool = { name: "café", description: "Résumé", parameters: { type: "object" } };
		const content = [{ type: "text", text: "🔎 café" }];
		const sample = measureExposure([tool], content, ["alpha:records.read00"]);
		expect(sample.schemaUtf8Bytes).toBe(Buffer.byteLength(JSON.stringify([tool]), "utf8"));
		expect(sample.resultUtf8Bytes).toBe(Buffer.byteLength(JSON.stringify(content), "utf8"));
		expect(sample.estimatedSchemaTokens).toBe(
			Math.ceil((tool.name.length + tool.description.length + JSON.stringify(tool.parameters).length) / 4),
		);
		expect(sample.estimatedResultTokens).toBe(Math.ceil(JSON.stringify(content).length / 4));
		expect(sample.providerUsage).toBeNull();
	});

	it("rejects oversized measurement inputs", () => {
		expect(() =>
			measureExposure(
				[],
				[],
				Array.from({ length: 129 }, () => "op"),
			),
		).toThrow("fixture capacity");
		expect(() => measureExposure([], [{ type: "text", text: "x".repeat(131_073) }], [])).toThrow("fixture bytes");
	});
});
