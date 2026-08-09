import { describe, expect, it } from "bun:test";
import { renderToTerminal } from "@danypops/pi-tui-harness";
import { type ExtensionContext, initTheme, type Theme } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import { requestPiApproval } from "../src/hitl-prompt.ts";

initTheme();

const theme = {
	fg: (_color: string, text: string) => text,
	bold: (text: string) => text,
} as unknown as Theme;
const tui = { terminal: { rows: 40 }, requestRender: () => {} };

async function plain(component: Component, width = 90): Promise<string> {
	const lines = component.render(width);
	const terminal = await renderToTerminal(lines, { cols: width, rows: lines.length });
	try {
		return terminal.plainLines().join("\n");
	} finally {
		terminal.dispose();
	}
}

describe("shared Vehicle approval HITL presenter", () => {
	it("renders and resolves the polished approval component as a blocking overlay", async () => {
		let overlayOptions: unknown;
		let frame = "";
		const context = {
			hasUI: true,
			mode: "tui",
			ui: {
				theme,
				custom: <T>(factory: (tui: unknown, theme: Theme, keybindings: unknown, done: (value: T) => void) => Component, options: unknown) =>
					new Promise<T>((resolve) => {
						overlayOptions = options;
						const component = factory(tui, theme, {}, resolve);
						void plain(component).then((text) => {
							frame = text;
							component.handleInput?.("\r");
						});
					}),
				confirm: async () => {
					throw new Error("native fallback must not run");
				},
			},
		} as unknown as ExtensionContext;

		const answer = await requestPiApproval(context, {
			title: "Approve Delete Artifact?",
			message: 'papyrus.delete@1 (destructive effect) requests approval.\n\nInput:\n{"id":"task-42"}',
			presentation: "overlay",
		});

		expect(overlayOptions).toEqual({
			overlay: true,
			overlayOptions: { anchor: "center", width: "80%", minWidth: 40, maxHeight: "80%", margin: 1 },
		});
		expect(frame).toContain("Approve Delete Artifact?");
		expect(frame).toContain("destructive effect");
		expect(frame).toContain("Approve");
		expect(frame).toContain("Deny");
		expect(frame).toContain("add optional comment");
		expect(answer).toEqual({ approved: true });
	});

	it("retains an optional comment with the approval answer", async () => {
		const context = {
			hasUI: true,
			mode: "tui",
			ui: {
				theme,
				custom: <T>(factory: (tui: unknown, theme: Theme, keybindings: unknown, done: (value: T) => void) => Component) =>
					new Promise<T>((resolve) => {
						const component = factory(tui, theme, {}, resolve);
						component.handleInput?.("c");
						component.handleInput?.("Reviewed the exact input.");
						component.handleInput?.("\r");
						component.handleInput?.("\r");
					}),
			},
		} as unknown as ExtensionContext;

		await expect(requestPiApproval(context, { title: "Approve?", message: "Details" })).resolves.toEqual({
			approved: true,
			comment: "Reviewed the exact input.",
		});
	});

	it("integrated mode preserves the outgoing editor draft and restores the exact factory", async () => {
		const previousFactory = () => ({ render: () => ["previous"], invalidate: () => {} });
		const calls: unknown[] = [];
		const context = {
			hasUI: true,
			mode: "tui",
			ui: {
				theme,
				getEditorComponent: () => previousFactory,
				getEditorText: () => "unsent human draft",
				setEditorComponent: (factory: unknown) => calls.push(factory),
				confirm: async () => {
					throw new Error("native fallback must not run");
				},
			},
		} as unknown as ExtensionContext;

		const pending = requestPiApproval(context, { title: "Approve?", message: "Details", presentation: "integrated" });
		expect(calls).toHaveLength(1);
		const installed = calls[0] as (tui: unknown, editorTheme: unknown, keybindings: unknown) => Component & { getText(): string };
		const host = installed(tui, {}, {});
		expect(host.getText()).toBe("unsent human draft");
		host.handleInput?.("\x1b[B");
		host.handleInput?.("\r");

		expect(await pending).toEqual({ approved: false });
		expect(calls).toEqual([installed, previousFactory]);
	});
});
