import { describe, expect, it } from "bun:test";
import { createExtensionHarness } from "@danypops/pi-extension-harness";
import { renderToTerminal } from "@danypops/pi-tui-harness";
import { LocalVehicleClient } from "@danypops/vehicle-client/local";
import { bindVehicleOperation, defineVehicleOperation, defineVehicleSchema } from "@danypops/vehicle-core";
import { VehicleRegistry } from "@danypops/vehicle-server";
import { initTheme, type ToolDefinition, ToolExecutionComponent } from "@earendil-works/pi-coding-agent";
import { KeybindingsManager, setKeybindings, type TUI, TUI_KEYBINDINGS } from "@earendil-works/pi-tui";
import { registerVehicleTools } from "../src/vehicle-pi.ts";

interface ListInput {
	query: string;
}

interface ListOutput {
	items: Array<{ id: string; title: string }>;
	content: Array<{ type: "text"; text: string }>;
}

const limits = {
	defaultTimeoutMs: 1_000,
	maxTimeoutMs: 5_000,
	maxRequestBytes: 1_024,
	maxResponseBytes: 256 * 1024,
};

const inputSchema = defineVehicleSchema<ListInput>({
	jsonSchema: {
		type: "object",
		properties: { query: { type: "string" } },
		required: ["query"],
		additionalProperties: false,
	},
	safeParse: (value) =>
		typeof value === "object" && value !== null && typeof (value as { query?: unknown }).query === "string"
			? { success: true, value: value as ListInput }
			: { success: false, issues: [{ path: ["query"], message: "query is required" }] },
});

const outputSchema = defineVehicleSchema<ListOutput>({
	jsonSchema: {
		type: "object",
		properties: {
			items: { type: "array", items: { type: "object" } },
			content: { type: "array", items: { type: "object" } },
		},
		required: ["items", "content"],
		additionalProperties: false,
	},
	safeParse: (value) => {
		if (typeof value !== "object" || value === null) {
			return { success: false, issues: [{ path: [], message: "output must be an object" }] };
		}
		const output = value as Partial<ListOutput>;
		if (!Array.isArray(output.items) || !Array.isArray(output.content)) {
			return { success: false, issues: [{ path: [], message: "items and content are required" }] };
		}
		return { success: true, value: output as ListOutput };
	},
});

const listOperation = defineVehicleOperation({
	name: "records.list",
	version: 1,
	description: "Lists enough records to exercise persisted and interactive presentation bounds.",
	input: inputSchema,
	output: outputSchema,
	permissions: [],
	effect: "read",
	idempotency: { mode: "safe" },
	limits,
});

initTheme();
setKeybindings(
	new KeybindingsManager({
		...TUI_KEYBINDINGS,
		"app.tools.expand": { defaultKeys: "ctrl+o", description: "Toggle tool output" },
	}),
);

async function plainFrame(component: ToolExecutionComponent, width: number): Promise<string> {
	const rendered = component.render(width);
	const terminal = await renderToTerminal(rendered, { cols: width, rows: rendered.length });
	try {
		return terminal.plainLines().join("\n");
	} finally {
		terminal.dispose();
	}
}

describe("Vehicle tool expansion through Pi's ToolExecutionComponent", () => {
	it("expands only the bounded persisted presentation and leaves the tool result immutable", async () => {
		const sourceRows = Array.from({ length: 80 }, (_, index) => ({
			id: `row-${String(index).padStart(2, "0")}`,
			title: `Record ${index}`,
		}));
		const registry = new VehicleRegistry({ name: "expansion-test", version: "1.0.0", description: "Expansion test" });
		registry.register(
			"records",
			bindVehicleOperation(listOperation, () => async () => ({
				items: sourceRows,
				content: [{ type: "text" as const, text: "MODEL_ONLY: 80 records matched" }],
			})),
		);
		const client = new LocalVehicleClient(registry);
		const harness = createExtensionHarness(() => {});
		await registerVehicleTools(harness.api, client);
		const tool = harness.tools.get("records_list")?.definition as ToolDefinition | undefined;
		expect(tool?.renderResult).toBeDefined();

		const result = await tool!.execute("call-1", { query: "all" }, undefined, undefined, {
			sessionManager: { getSessionId: () => "session-1" },
			hasUI: false,
		} as never);
		const persistedBeforeExpansion = JSON.stringify(result);
		expect(result.content).toEqual([{ type: "text", text: "MODEL_ONLY: 80 records matched" }]);

		const component = new ToolExecutionComponent(
			"records_list",
			"call-1",
			{ query: "all" },
			{},
			tool,
			{ requestRender: () => {} } as TUI,
			process.cwd(),
		);
		component.markExecutionStarted();
		component.setArgsComplete();
		component.updateResult({ ...result, isError: false }, false);

		const collapsed = await plainFrame(component, 120);
		expect(collapsed).toContain("row-00");
		expect(collapsed).toContain("row-19");
		expect(collapsed).not.toContain("row-20");
		expect(collapsed).toContain("30 more rows");
		expect(collapsed).toContain("ctrl+o");
		expect(collapsed).not.toContain("MODEL_ONLY");

		component.setExpanded(true);
		const expanded = await plainFrame(component, 120);
		expect(expanded).toContain("row-49");
		expect(expanded).not.toContain("row-50");
		expect(expanded).not.toContain("row-79");
		expect(expanded).toContain("30 omitted before persistence");
		expect(expanded).not.toContain("more rows");
		expect(expanded).not.toContain("MODEL_ONLY");
		expect(JSON.stringify(result)).toBe(persistedBeforeExpansion);
	});
});
