import { expect, it, spyOn } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createExtensionHarness } from "@danypops/pi-extension-harness";
import { auditVehicleOperationContracts } from "@danypops/vehicle-conformance/core";
import { type JsonSchema, projectVehicleOperation } from "@danypops/vehicle-core";
import { registerVehicleTools } from "../src/vehicle-pi.ts";
import { __resetVehicleShellHandleForTests } from "../src/vehicle-shell.ts";
import { __resetInProcessVehicleRegistryForTests } from "../src/vehicle-shell-registry.ts";
import { strictClient, strictOperation } from "./fixtures/strict-contract.ts";

const fixture = fileURLToPath(new URL("./fixtures/strict-contract.ts", import.meta.url));
const input = { selection: { prefix: "abc", limit: 2 } };

it("shares the contract across real CLI, client and registered Pi tools", async () => {
	__resetVehicleShellHandleForTests();
	__resetInProcessVehicleRegistryForTests();
	const client = strictClient();
	const harness = createExtensionHarness(() => {});
	try {
		await registerVehicleTools(harness.api, client, {
			permissions: ["records:read"],
			shell: { coreOperations: ["records.list"], toolboxReminder: { enabled: false } },
		});
		await harness.boot();
		const tool = harness.tools.get("records_list");
		if (!tool) throw new Error("Missing projected tool");
		const projected = projectVehicleOperation(strictOperation);
		const cli = JSON.parse(
			execFileSync("bun", [fixture, "--input", JSON.stringify(input), "--json"], { encoding: "utf8", timeout: 10_000, maxBuffer: 65_536 }),
		);
		expect(cli).toEqual(await projected.invoke(client, input, { permissions: ["records:read"] }));
		const invoke = spyOn(client, "invoke");
		await harness.invokeTool("records_list", input);
		const index = invoke.mock.calls.findIndex(([name]) => name === "records.list");
		expect(index).toBeGreaterThanOrEqual(0);
		expect(await invoke.mock.results[index]?.value).toEqual(cli);
		invoke.mockRestore();
		await expect(harness.invokeTool("records_list", { selection: { prefix: "abc", limit: 4 } })).rejects.toMatchObject({
			failure: { code: "invalid-input" },
		});
		const audit = auditVehicleOperationContracts(
			[strictOperation.descriptor],
			[
				{
					surface: "pi",
					exposedName: tool.definition.name,
					descriptor: { ...strictOperation.descriptor, inputSchema: tool.definition.parameters as JsonSchema },
					presentation: "generic",
				},
				{ surface: "cli", exposedName: "records.list", descriptor: JSON.parse(projected.help).operation, presentation: "generic" },
			],
			{ readPermissions: ["records:read"] },
		);
		expect(audit.complete).toBe(true);
		expect(audit.issues).toHaveLength(0);
	} finally {
		await harness.shutdown();
		await client.close();
		__resetVehicleShellHandleForTests();
		__resetInProcessVehicleRegistryForTests();
	}
});

it("keeps CLI validation and authorization failures machine-readable", () => {
	for (const [payload, deny, code] of [
		[{ selection: { prefix: "abc", limit: 4 } }, "0", "invalid-input"],
		[input, "1", "permission-denied"],
	] as const) {
		const result = spawnSync("bun", [fixture, "--input", JSON.stringify(payload), "--json"], {
			encoding: "utf8",
			timeout: 10_000,
			maxBuffer: 65_536,
			env: { ...process.env, FIXTURE_DENY: deny },
		});
		expect(result.error).toBeUndefined();
		expect(result.status).toBe(1);
		expect(JSON.parse(result.stdout)).toEqual({ error: code });
	}
});
