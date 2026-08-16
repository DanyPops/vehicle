import { describe, expect, it } from "bun:test";
import type { VehicleManifest, VehicleOperationDescriptor } from "@danypops/vehicle-core";
import { initTheme, ToolExecutionComponent } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";
import { renderToTerminal } from "@danypops/pi-tui-harness";
import { createTool } from "../src/vehicle-pi/tool-creation.ts";

// Never actually invoked by either test -- both only construct the tool definition and drive
// ToolExecutionComponent.updateResult() directly, bypassing execute() entirely -- so a loose cast
// here is fine rather than fabricating a full, unused PiVehicleToolDetails shape.
const neverInvoked = { invoke: (async () => ({ content: [], details: {} })) as never };

/**
 * Deterministic repro for the reported "tool row background/height mismatch across a streaming
 * isPartial -> final render transition" -- drives a REAL ToolExecutionComponent (the same one Pi
 * itself uses for every tool call row, imported directly from @earendil-works/pi-coding-agent,
 * never a mock) through the exact partial -> final sequence a ci_wait-shaped Vehicle operation
 * produces via context.reportProgress(), then feeds the FINAL render's real ANSI output through a
 * real terminal emulator (renderToTerminal) to inspect whether every line of the final content
 * carries the expected background -- the observable symptom described in the bug report.
 */

const limits = { defaultTimeoutMs: 1_000, maxTimeoutMs: 5_000, maxRequestBytes: 1_024, maxResponseBytes: 1_024 };

function descriptor(): VehicleOperationDescriptor {
	return {
		name: "ci.wait",
		version: 1,
		description: "Waits for a CI run to settle.",
		inputSchema: { type: "object" },
		outputSchema: { type: "object" },
		permissions: [],
		effect: "read",
		idempotency: { mode: "safe" },
		streaming: true,
		longRunning: true,
		limits,
		errors: [],
	};
}

const manifest: VehicleManifest = { name: "pipes", version: "1.0.0", description: "Test.", operations: [] };

initTheme();

function fakeUi(): TUI {
	return { requestRender: () => {} } as unknown as TUI;
}

describe("ToolExecutionComponent: streaming isPartial -> final render transition", () => {
	it("the final render's own line count reflects the final content, not the earlier partial's", async () => {
		const toolDefinition = createTool(neverInvoked, {} as never, manifest, descriptor(), "ci_wait", {});
		const component = new ToolExecutionComponent("ci_wait", "call-1", {}, {}, toolDefinition, fakeUi(), process.cwd());

		// First frame: isPartial=true, one line ("Running...").
		component.updateResult({ content: [{ type: "text", text: "Running..." }], isError: false }, true);
		const partialLines = component.render(120);

		// Second frame: the real final result -- multi-line, an error (matches the bug report's own
		// "Error: vehicle-client-failed: fetch failed" + a further line shape).
		const finalText = "Error: vehicle-client-failed: fetch failed\nline two of the final result\nline three of the final result";
		component.updateResult({ content: [{ type: "text", text: finalText }], isError: true }, false);
		const finalLines = component.render(120);

		// The final render must reflect the final (longer) content -- not stay pinned at the
		// partial frame's own (shorter) line count.
		expect(finalLines.length).toBeGreaterThan(partialLines.length);
		expect(finalLines.join("\n")).toContain("line three of the final result");
	});

	it("every line of the box's own content (excluding ToolExecutionComponent's own fixed top-margin Spacer) carries the final result's real background -- none of the final content floats over the plain terminal background", async () => {
		const toolDefinition = createTool(neverInvoked, {} as never, manifest, descriptor(), "ci_wait", {});
		const component = new ToolExecutionComponent("ci_wait", "call-1", {}, {}, toolDefinition, fakeUi(), process.cwd());

		component.updateResult({ content: [{ type: "text", text: "Running..." }], isError: false }, true);
		component.render(120);

		const finalText = "Error: vehicle-client-failed: fetch failed\nline two of the final result\nline three of the final result";
		component.updateResult({ content: [{ type: "text", text: finalText }], isError: true }, false);
		const finalLines = component.render(120);

		const terminal = await renderToTerminal(finalLines, { cols: 120 });
		try {
			// Row 0 is ToolExecutionComponent's own fixed `new Spacer(1)` margin, added directly to its
			// container (never to contentBox) -- by design, always background-less, unrelated to the box
			// itself. Rows 1..end are the box's own real content (top padding, title, every result line,
			// bottom padding) and must ALL carry the same (error) background -- the exact shape the bug
			// report described missing.
			expect(terminal.cellAt(0, 0)?.isBgDefault).toBe(true);
			for (let row = 1; row < terminal.rows; row++) {
				const cell = terminal.cellAt(row, 0);
				expect(cell).toBeDefined();
				expect(cell?.isBgDefault).toBe(false);
			}
			// Every real content line, including the LAST line of the final (longer) result, is present
			// under that background -- the box grew to fit it, it didn't get left outside the shell.
			expect(terminal.plainLines().join("\n")).toContain("line three of the final result");
		} finally {
			terminal.dispose();
		}
	});
});
