import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { driveComponent, renderToTerminal } from "@danypops/pi-tui-harness";
import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { type Component, type EditorTheme, KeybindingsManager, type TUI, TUI_KEYBINDINGS } from "@earendil-works/pi-tui";
import { renderSectionSeparator, requestPiAskPrompt, shouldShowSectionSeparator } from "../src/hitl-ask-prompt.ts";
import {
	ensureTypingCourtesyTracking,
	isLiveAskPending,
	isRecentlyTyping,
	resetTypingCourtesyTrackingForTests,
	setTypingCourtesyTimingForTests,
	waitForTypingCourtesy,
} from "../src/hitl-ask-typing-courtesy.ts";
import { OVERLAY_MAX_HEIGHT_RATIO, type PiHitlContext } from "../src/hitl-prompt.ts";

// Not exported from @earendil-works/pi-coding-agent's own public entrypoint (only its internal
// core/extensions/types.ts) -- derived via the real setEditorComponent signature instead of an
// `any` stand-in, so every mock ui.setEditorComponent below stays honestly typed.
type EditorFactory = NonNullable<Parameters<ExtensionContext["ui"]["setEditorComponent"]>[0]>;

const originalEnv = { ...process.env };
// The ambient keystroke clock is module-level state (deliberately -- see ensureTypingCourtesyTracking's
// own comment) shared across every test in this file; reset it so one test's simulated typing can't
// bleed into another's. None of the tests outside the dedicated "typing courtesy" block below ever
// simulate a keystroke, so isRecentlyTyping() stays false for them without any extra setup.
beforeEach(() => {
	resetTypingCourtesyTrackingForTests();
	setTypingCourtesyTimingForTests();
});
afterEach(() => {
	for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
	Object.assign(process.env, originalEnv);
});

const theme = {
	bold: (t: string) => t,
	italic: (t: string) => t,
	underline: (t: string) => t,
	strikethrough: (t: string) => t,
	fg: (_c: string, t: string) => t,
} as Theme;
// EditorFactory's own keybindings parameter is pi-coding-agent's re-exported KeybindingsManager
// (a distinct, structurally-incompatible nominal type from pi-tui's own, adding
// configPath/reload/getEffectiveConfig) -- but hitl-ask-prompt.ts's real production code is typed
// against pi-tui's KeybindingsManager throughout and never touches those extra members, so this
// is the one cast this file needs to bridge that gap, rather than constructing a second fake
// KeybindingsManager implementation no test here actually needs.
const keybindings = new KeybindingsManager(TUI_KEYBINDINGS) as unknown as Parameters<EditorFactory>[2];
// A minimal stand-in for the real EditorTheme -- only borderColor is ever exercised by this
// suite's assertions, so the (untyped-at-runtime) selectList placeholder is cast once here
// rather than at each of this file's many call sites.
const fakeEditorTheme = { borderColor: (s: string) => s, selectList: {} } as unknown as EditorTheme;
const ENTER = "\r";
const ESCAPE = "\x1b";

/**
 * setEditorComponent as the real interactive TUI would run it, exercising the genuine
 * AskComponent/WrappedSingleSelectList/DiscussionMultiSelectList code the same way a real session would.
 * Ignores the SECOND setEditorComponent call (restoring the previous factory once answered)
 * rather than treating it as a new ask.
 */
function interactiveCtx(keySequence: string[]): ExtensionContext {
	const tui = { terminal: { rows: 40 }, requestRender: () => {} } as unknown as TUI;
	let installed = false;
	return {
		cwd: "/tmp",
		hasUI: true,
		ui: {
			select: async () => {
				throw new Error("should not fall back to dialog select in interactive mode");
			},
			input: async () => {
				throw new Error("should not fall back to dialog input in interactive mode");
			},
			notify: () => {},
			theme,
			getEditorText: () => "",
			getEditorComponent: () => undefined,
			setEditorComponent: (factory: EditorFactory) => {
				if (installed || !factory) {
					installed = false;
					return;
				}
				installed = true;
				const host = factory(tui, fakeEditorTheme, keybindings);
				for (const key of keySequence) host.handleInput(key);
			},
		} as unknown as ExtensionContext["ui"],
	} as ExtensionContext;
}

/**
 * Regression coverage for a real live-observed bug: the picker silently resolved to "cancelled"
 * roughly 7-10 seconds after opening, well before a human had actually finished deciding, with
 * their real answer then arriving disconnected as a stray follow-up message. Root cause: the
 * abort listener was wired to ExtensionContext.signal ("is the agent currently streaming") --
 * which settles/aborts shortly after the assistant's tool_call message finishes generating, not
 * when the human is done -- instead of the tool call's own per-execution signal (execute()'s 3rd
 * parameter). ctx.signal firing must never cancel the ask; only the passed-through params.signal
 * (or its absence) should.
 */
describe("hitl-ask-prompt: shared dual-host HITL ask experience, owned end-to-end", () => {
	it("ctx.signal aborting must NOT cancel the ask -- only the tool call's own passed-through signal should", async () => {
		const tui = { terminal: { rows: 40 }, requestRender: () => {} } as unknown as TUI;
		const contextSignalController = new AbortController();
		let component: { handleInput: (data: string) => void } | undefined;
		const ctx = {
			cwd: "/tmp",
			hasUI: true,
			signal: contextSignalController.signal,
			ui: {
				select: async () => {
					throw new Error("should not fall back to dialog select in interactive mode");
				},
				input: async () => {
					throw new Error("should not fall back to dialog input in interactive mode");
				},
				notify: () => {},
				theme,
				getEditorText: () => "",
				getEditorComponent: () => undefined,
				setEditorComponent: (factory: EditorFactory) => {
					if (factory) component = factory(tui, fakeEditorTheme, keybindings);
				},
			} as unknown as ExtensionContext["ui"],
		} as ExtensionContext;
		const promise = requestPiAskPrompt(ctx, { question: "Ship or not?", options: [{ title: "Ship Friday" }, { title: "Slip to Monday" }] });
		await new Promise((resolve) => setTimeout(resolve, 0));
		// Simulate the session's own streaming-turn signal settling shortly after the tool_call was
		// emitted -- routine, unrelated bookkeeping that happens long before a human actually answers.
		contextSignalController.abort();
		await new Promise((resolve) => setTimeout(resolve, 10));
		// The ask must still be genuinely pending -- ctx.signal aborting must not have resolved it.
		const raced = await Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve("still-pending"), 20))]);
		expect(raced).toBe("still-pending");
		// Clean up: answer for real so this test doesn't leak a permanently-pending ask/livePendingCount into later tests.
		component?.handleInput(ENTER);
		expect(await promise).toEqual({ content: "Ship Friday", selected: ["Ship Friday"] });
	});

	it("the tool call's own passed-through signal DOES cancel the ask when it aborts", async () => {
		const tui = { terminal: { rows: 40 }, requestRender: () => {} } as unknown as TUI;
		const toolCallController = new AbortController();
		const ctx = {
			cwd: "/tmp",
			hasUI: true,
			ui: {
				select: async () => {
					throw new Error("unexpected");
				},
				input: async () => {
					throw new Error("unexpected");
				},
				notify: () => {},
				theme,
				getEditorText: () => "",
				getEditorComponent: () => undefined,
				setEditorComponent: (factory: EditorFactory) => {
					if (factory) factory(tui, fakeEditorTheme, keybindings);
				},
			} as unknown as ExtensionContext["ui"],
		} as ExtensionContext;
		const promise = requestPiAskPrompt(ctx, {
			question: "Ship or not?",
			options: [{ title: "Ship Friday" }],
			signal: toolCallController.signal,
		});
		toolCallController.abort();
		expect(await promise).toBeUndefined();
	});

	it("single-select: pressing enter picks the currently highlighted option through the real AskComponent", async () => {
		const ctx = interactiveCtx([ENTER]);
		const answer = await requestPiAskPrompt(ctx, {
			question: "Ship or not?",
			options: [{ title: "Ship Friday" }, { title: "Slip to Monday" }],
		});
		expect(answer).toEqual({ content: "Ship Friday", selected: ["Ship Friday"] });
	});

	it("single-select: arrow-down then enter picks the second option", async () => {
		const ctx = interactiveCtx(["\x1b[B", ENTER]);
		const answer = await requestPiAskPrompt(ctx, {
			question: "Ship or not?",
			options: [{ title: "Ship Friday" }, { title: "Slip to Monday" }],
		});
		expect(answer).toEqual({ content: "Slip to Monday", selected: ["Slip to Monday"] });
	});

	it("boxTitle is a generic, optional caller-supplied label -- no default branding baked into the shared prompt", async () => {
		const ctx = interactiveCtx([ENTER]);
		const tui = { terminal: { rows: 40 }, requestRender: () => {} } as unknown as TUI;
		let component: { render: (w: number) => string[]; handleInput: (data: string) => void } | undefined;
		const captureCtx = {
			...ctx,
			ui: {
				...ctx.ui,
				setEditorComponent: (factory: EditorFactory) => {
					if (!factory) return;
					component = factory(tui, fakeEditorTheme, keybindings);
				},
			},
		} as unknown as ExtensionContext;
		const pending = requestPiAskPrompt(captureCtx, { question: "Ship or not?", options: [{ title: "Ship Friday" }] });
		await new Promise((resolve) => setTimeout(resolve, 0));
		const rendered = component!.render(100).join("\n");
		expect(rendered).not.toContain("discuss");
		component!.handleInput(ENTER);
		await pending;
	});

	it("overlay presentation hosts the same rich component as a blocking popup over the transcript", async () => {
		const tui = { terminal: { rows: 40 }, requestRender: () => {} } as unknown as TUI;
		let customOptions: unknown;
		let rendered = "";
		let editorSwapCalled = false;
		const ctx = {
			cwd: "/tmp",
			mode: "tui",
			hasUI: true,
			ui: {
				custom: <T>(
					factory: (tui: unknown, theme: Theme, keybindings: KeybindingsManager, done: (value: T) => void) => Component,
					options: unknown,
				) =>
					new Promise<T>((resolve) => {
						customOptions = options;
						const component = factory(tui, theme, keybindings, resolve);
						rendered = component.render(100).join("\n");
						component.handleInput?.(ENTER);
					}),
				select: async () => {
					throw new Error("should not fall back to dialogs");
				},
				input: async () => {
					throw new Error("should not fall back to dialogs");
				},
				setEditorComponent: () => {
					editorSwapCalled = true;
				},
				notify: () => {},
				theme,
			},
		} as unknown as ExtensionContext;

		const answer = await requestPiAskPrompt(ctx, {
			question: "Ship or not?",
			subtitle: "Release decision",
			boxTitle: "ask",
			options: [{ title: "Ship Friday" }, { title: "Slip to Monday" }],
			presentation: "overlay",
		});

		expect(customOptions).toEqual({
			overlay: true,
			overlayOptions: { anchor: "center", width: "80%", minWidth: 40, maxHeight: "80%", margin: 1 },
		});
		expect(rendered).toContain("ask");
		expect(rendered).toContain("Release decision");
		expect(rendered).toContain("Ship Friday");
		expect(editorSwapCalled).toBe(false);
		expect(answer).toEqual({ content: "Ship Friday", selected: ["Ship Friday"] });
	});

	it("overlay's height budget can use (near-)the full terminal instead of integrated's protective 50% ceiling -- confirmed live: an approval prompt's own multi-line body needed scrolling under the old shared ratio even though overlay already floats over the transcript instead of displacing it", async () => {
		const tui = { terminal: { rows: 40 }, requestRender: () => {} } as unknown as TUI;
		// Long enough that neither presentation's own budget can show it all -- what's under test is
		// how MUCH each shows, not whether either shows everything.
		const longContext = Array.from({ length: 60 }, (_, index) => `Line ${index + 1} of a long approval body.`).join("\n");
		const askParams = { question: "Approve?", context: longContext, options: [{ title: "Approve" }, { title: "Deny" }] };

		const integratedCtx = interactiveCtx([]);
		let integratedComponent: { render: (w: number) => string[]; handleInput: (data: string) => void } | undefined;
		const captureIntegratedCtx = {
			...integratedCtx,
			ui: {
				...integratedCtx.ui,
				setEditorComponent: (factory: EditorFactory) => {
					if (!factory) return;
					integratedComponent = factory(tui, fakeEditorTheme, keybindings);
				},
			},
		} as unknown as ExtensionContext;
		const pendingIntegrated = requestPiAskPrompt(captureIntegratedCtx, { ...askParams, presentation: "integrated" });
		await new Promise((resolve) => setTimeout(resolve, 0));
		const integratedLines = integratedComponent!.render(100);
		integratedComponent!.handleInput(ENTER);
		await pendingIntegrated;

		let overlayComponent: { render: (w: number) => string[]; handleInput: (data: string) => void } | undefined;
		const overlayCtx = {
			cwd: "/tmp",
			mode: "tui",
			hasUI: true,
			ui: {
				custom: <T>(factory: (tui: unknown, theme: Theme, keybindings: KeybindingsManager, done: (value: T) => void) => Component) =>
					new Promise<T>((resolve) => {
						overlayComponent = factory(tui, theme, keybindings, resolve) as unknown as typeof overlayComponent;
					}),
				select: async () => {
					throw new Error("should not fall back to dialogs");
				},
				input: async () => {
					throw new Error("should not fall back to dialogs");
				},
				notify: () => {},
				theme,
			},
		} as unknown as ExtensionContext;
		const pendingOverlay = requestPiAskPrompt(overlayCtx, { ...askParams, presentation: "overlay" });
		await new Promise((resolve) => setTimeout(resolve, 0));
		const overlayLines = overlayComponent!.render(100);
		overlayComponent!.handleInput(ENTER);
		await pendingOverlay;

		// integrated stays near the documented ~50% ceiling (terminal.rows=40 -> ~19-20 body lines);
		// overlay reaches for OVERLAY_MAX_HEIGHT_RATIO instead (terminal.rows=40 -> ~32 body lines) --
		// the exact same ratio the real overlay host (pi-tui's compositeOverlays) enforces via
		// DUAL_HOST_OVERLAY_OPTIONS' own maxHeight: "80%", not independently re-guessed. Asking for
		// MORE than that real host ceiling is the actual regression this covers: pi-tui hard-truncates
		// from the bottom of an overlay's render once it exceeds maxHeight (slice(0, maxHeight)),
		// silently swallowing the component's own closing border along with everything past the cut --
		// confirmed live when this ratio was briefly 1 (100%) instead of the correct 0.8.
		const hostRealCeiling = Math.floor(40 * OVERLAY_MAX_HEIGHT_RATIO);
		expect(integratedLines.length).toBeLessThanOrEqual(22);
		expect(overlayLines.length).toBeGreaterThan(integratedLines.length * 1.3);
		expect(overlayLines.length).toBeLessThanOrEqual(hostRealCeiling);
		expect(overlayLines.length).toBe(hostRealCeiling);
	});

	it("multi-select: toggling two rows by digit then confirming returns both, comma-joined", async () => {
		const ctx = interactiveCtx(["1", "2", ENTER]);
		const answer = await requestPiAskPrompt(ctx, {
			question: "Which regions?",
			options: [{ title: "us-east" }, { title: "eu-west" }],
			allowMultiple: true,
		});
		expect(answer).toEqual({ content: "us-east, eu-west", selected: ["us-east", "eu-west"] });
	});

	it("multi-select: moving past the four-row viewport keeps the focused topic visible and toggleable", async () => {
		const tui = { terminal: { rows: 20 }, requestRender: () => {} } as unknown as TUI;
		let component: Component | undefined;
		const ctx = {
			cwd: "/tmp",
			hasUI: true,
			ui: {
				select: async () => {
					throw new Error("unexpected dialog fallback");
				},
				input: async () => {
					throw new Error("unexpected dialog fallback");
				},
				notify: () => {},
				theme,
				getEditorText: () => "",
				getEditorComponent: () => undefined,
				setEditorComponent: (factory: EditorFactory) => {
					if (factory) component = factory(tui, fakeEditorTheme, keybindings);
				},
			} as unknown as ExtensionContext["ui"],
		} as ExtensionContext;
		const topics = [
			"Per-item output budgeting",
			"Persisted-graph reliability",
			"TypeScript call-hierarchy failure handling",
			"Symbol and dataflow history",
			"Cross-workspace symbol search",
			"Package-source cache lifecycle",
			"Workspace annotation freshness",
		];
		const pending = requestPiAskPrompt(ctx, {
			question: "Triage Lector notes into concrete tasks",
			options: topics.map((title) => ({ title })),
			allowMultiple: true,
		});
		const driven = driveComponent(component!);
		const visibleText = async (): Promise<string> => {
			const frame = driven.render(100);
			const terminal = await renderToTerminal(frame, { cols: 100, rows: frame.length });
			try {
				return terminal.plainLines().join("\n");
			} finally {
				terminal.dispose();
			}
		};

		const initial = await visibleText();
		expect(initial).toContain("4. [ ] Symbol and dataflow history");
		expect(initial).not.toContain("5. [ ] Cross-workspace symbol search");

		driven.pressKeys(["down", "down", "down", "down"]);
		expect(await visibleText()).toContain("→ 5. [ ] Cross-workspace symbol search");

		driven.pressKey("space");
		expect(await visibleText()).toContain("→ 5. [✓] Cross-workspace symbol search");
		driven.pressKey("space");
		expect(await visibleText()).toContain("→ 5. [ ] Cross-workspace symbol search");
		driven.pressKeys(["space", "enter"]);
		expect(await pending).toEqual({
			content: "Cross-workspace symbol search",
			selected: ["Cross-workspace symbol search"],
		});
	});

	it("escape cancels the picker -- resolves to undefined, never a fabricated answer", async () => {
		const ctx = interactiveCtx([ESCAPE]);
		const answer = await requestPiAskPrompt(ctx, {
			question: "Ship or not?",
			options: [{ title: "Ship Friday" }, { title: "Slip to Monday" }],
		});
		expect(answer).toBeUndefined();
	});

	// Regression: a freeform-only ask (no options) used to bypass AskComponent entirely and go
	// straight through a bare ctx.ui.input(), rendering as a plain contextless line while every
	// options-bearing ask got the full bordered box, title, and markdown context. A human live-
	// observed this inconsistency directly. Freeform-only asks must use the same rich AskComponent
	// whenever a real ctx.ui.custom() is available, falling back to ctx.ui.input only in RPC/headless
	// mode (same fallback every other ask already uses).
	// Regression: liveAnswer's generic "Reply to <title>:" wrapper was shown as the primary,
	// bolded "Question", with the discussion's real content demoted to a "Context:" section below
	// it -- backwards, live-observed directly. The real content is now the question itself; the
	// discussion title is a plain dim subtitle, not a labeled section.
	it("renders the subtitle as plain dim text, never a generic 'Question' header, and never a redundant 'Custom answer' label when there are no options", async () => {
		const tui = { terminal: { rows: 40 }, requestRender: () => {} } as unknown as TUI;
		let component: { render: (w: number) => string[]; handleInput: (data: string) => void } | undefined;
		const ctx = {
			cwd: "/tmp",
			hasUI: true,
			ui: {
				select: async () => {
					throw new Error("unexpected");
				},
				input: async () => {
					throw new Error("unexpected");
				},
				notify: () => {},
				theme,
				getEditorText: () => "",
				getEditorComponent: () => undefined,
				setEditorComponent: (factory: EditorFactory) => {
					if (factory) component = factory(tui, fakeEditorTheme, keybindings);
				},
			} as unknown as ExtensionContext["ui"],
		} as ExtensionContext;
		const pending = requestPiAskPrompt(ctx, { question: "Should we ship Friday?", subtitle: "Ship or not?" });
		await new Promise((resolve) => setTimeout(resolve, 0));
		const rendered = component!.render(100).join("\n");
		expect(rendered).toContain("Ship or not?"); // subtitle present
		expect(rendered).not.toContain("Question"); // no generic header
		expect(rendered).not.toContain("Custom answer"); // no options to contrast against
		component!.handleInput(ESCAPE);
		await pending; // let isLiveAskPending's guard clear before the next test observes it
	});

	it("a freeform-only question (no options) uses the real AskComponent, typing text and pressing enter", async () => {
		const ctx = interactiveCtx([..."42", ENTER]);
		const answer = await requestPiAskPrompt(ctx, { question: "How many replicas?" });
		expect(answer).toEqual({ content: "42" });
	});

	it("a freeform-only question: escape cancels outright (no select mode to fall back to)", async () => {
		const ctx = interactiveCtx([ESCAPE]);
		const answer = await requestPiAskPrompt(ctx, { question: "How many replicas?" });
		expect(answer).toBeUndefined();
	});

	it("a freeform-only question still degrades to ctx.ui.input via the dialog fallback in RPC/headless mode", async () => {
		const prompts: string[] = [];
		const ctx = {
			cwd: "/tmp",
			hasUI: true,
			ui: {
				select: async () => undefined,
				input: async (title: string) => {
					prompts.push(title);
					return "42";
				},
				notify: () => {},
			},
		} as unknown as ExtensionContext;
		const answer = await requestPiAskPrompt(ctx, { question: "How many replicas?" });
		expect(prompts).toEqual(["How many replicas?"]);
		expect(answer).toEqual({ content: "42" });
	});

	it("freeform-only cancel (empty answer) resolves to undefined, not an empty content string", async () => {
		const ctx = {
			cwd: "/tmp",
			hasUI: true,
			ui: { select: async () => undefined, input: async () => undefined, notify: () => {} },
		} as unknown as ExtensionContext;
		expect(await requestPiAskPrompt(ctx, { question: "How many replicas?" })).toBeUndefined();
	});

	it("degrades to the dialog fallback (ctx.ui.select) when setEditorComponent isn't available -- RPC/headless mode", async () => {
		const selectCalls: Array<{ title: string; options: string[] }> = [];
		const ctx = {
			cwd: "/tmp",
			hasUI: true,
			ui: {
				select: async (title: string, options: string[]) => {
					selectCalls.push({ title, options });
					return "Ship Friday";
				},
				input: async () => undefined,
				notify: () => {},
			},
		} as unknown as ExtensionContext;
		const answer = await requestPiAskPrompt(ctx, {
			question: "Ship or not?",
			options: [{ title: "Ship Friday" }, { title: "Slip to Monday" }],
		});
		expect(selectCalls).toEqual([
			{ title: "Ship or not?", options: ["Ship Friday", "Slip to Monday", "\u270f\ufe0f Type a custom answer..."] },
		]);
		expect(answer).toEqual({ content: "Ship Friday", selected: ["Ship Friday"] });
	});

	it("degrades to undefined, not a throw, when there is no interactive UI at all", async () => {
		const ctx = { cwd: "/tmp", hasUI: false, ui: {} } as unknown as ExtensionContext;
		const answer = await requestPiAskPrompt(ctx, { question: "Ship or not?", options: [{ title: "Ship Friday" }] });
		expect(answer).toBeUndefined();
	});

	/**
	 * Regression coverage for a real live-observed bug: extension/src/index.ts's active-task
	 * continuation driver queues a "continue the active task" nudge on agent_settled, and
	 * ctx.isIdle() ("not streaming") reads true while a live ask is genuinely still pending on the
	 * human -- so without this guard, that nudge starts a second, concurrent turn reasoning about
	 * the very Discussion the pending live ask hasn't resolved yet. index.ts's driveActiveTasks
	 * checks isLiveAskPending() and skips queuing while a live ask is in flight.
	 */
	it("isLiveAskPending() is false at rest, true only while a live ask is genuinely blocked on the human, and false again once it resolves", async () => {
		expect(isLiveAskPending()).toBe(false);
		let observedDuringAsk: boolean | undefined;
		const ctx = {
			cwd: "/tmp",
			hasUI: true,
			ui: {
				select: async () => undefined,
				input: async () => {
					observedDuringAsk = isLiveAskPending();
					return "42";
				},
				notify: () => {},
			},
		} as unknown as ExtensionContext;
		const answer = await requestPiAskPrompt(ctx, { question: "How many replicas?" });
		expect(observedDuringAsk).toBe(true);
		expect(isLiveAskPending()).toBe(false);
		expect(answer).toEqual({ content: "42" });
	});

	it("isLiveAskPending() still clears on cancel, so a rejected/cancelled ask never leaves the guard stuck open", async () => {
		const ctx = {
			cwd: "/tmp",
			hasUI: true,
			ui: { select: async () => undefined, input: async () => undefined, notify: () => {} },
		} as unknown as ExtensionContext;
		await requestPiAskPrompt(ctx, { question: "How many replicas?" });
		expect(isLiveAskPending()).toBe(false);
	});

	/** The picker is always hosted via ctx.ui.setEditorComponent, Pi's own slash-command menu mechanism. */
	describe("hosted in the real input editor via setEditorComponent -- the only interactive path", () => {
		function editorCtx() {
			const setCalls: Array<EditorFactory | undefined> = [];
			// A pure reference-identity sentinel (compared via toBe below), never actually invoked as a
			// real editor factory -- cast once here at its own definition rather than laundering the
			// whole ui mock through `any`.
			const previousFactory = (() => "previous-editor-sentinel") as unknown as EditorFactory;
			const ctx = {
				cwd: "/tmp",
				hasUI: true,
				ui: {
					select: async () => {
						throw new Error("should not fall back to dialogs");
					},
					input: async () => {
						throw new Error("should not fall back to dialogs");
					},
					notify: () => {},
					theme,
					getEditorText: () => "human's in-progress draft",
					getEditorComponent: () => previousFactory,
					setEditorComponent: (factory: EditorFactory | undefined) => {
						setCalls.push(factory);
					},
				} as unknown as ExtensionContext["ui"],
			} as ExtensionContext;
			return { ctx, setCalls, previousFactory };
		}

		it("hosts the AskComponent via setEditorComponent", async () => {
			const { ctx, setCalls } = editorCtx();
			const promise = requestPiAskPrompt(ctx, {
				question: "Ship or not?",
				options: [{ title: "Ship Friday" }, { title: "Slip to Monday" }],
			});
			await new Promise((resolve) => setTimeout(resolve, 0));
			expect(setCalls).toHaveLength(1);
			const host = setCalls[0]!({ terminal: { rows: 40 }, requestRender: () => {} } as unknown as TUI, fakeEditorTheme, keybindings);
			host.handleInput(ENTER);
			const answer = await promise;
			expect(answer).toEqual({ content: "Ship Friday", selected: ["Ship Friday"] });
		});

		it("restores the exact previous editor factory once answered, and the host's getText() always returns the preserved draft verbatim", async () => {
			const { ctx, setCalls, previousFactory } = editorCtx();
			const promise = requestPiAskPrompt(ctx, { question: "Ship or not?", options: [{ title: "Ship Friday" }] });
			await new Promise((resolve) => setTimeout(resolve, 0));
			const host = setCalls[0]!({ terminal: { rows: 40 }, requestRender: () => {} } as unknown as TUI, fakeEditorTheme, keybindings);
			// setEditorComponent's own swap logic reads getText() off the outgoing editor to carry a
			// draft forward -- must never report anything but the human's real preserved text, even
			// after setText() is called on it (Pi's swap machinery calls setText with the prior text
			// when installing a NEW custom editor, not this one, but the contract must hold regardless).
			host.setText("anything else");
			expect(host.getText()).toBe("human's in-progress draft");
			host.handleInput(ENTER);
			await promise;
			expect(setCalls).toHaveLength(2);
			expect(setCalls[1]).toBe(previousFactory);
		});

		it("degrades to the plain dialog fallback, never a floating overlay, when setEditorComponent isn't available in this UI mode", async () => {
			const selectCalls: Array<{ title: string; options: string[] }> = [];
			const ctx = {
				cwd: "/tmp",
				hasUI: true,
				ui: {
					select: async (title: string, options: string[]) => {
						selectCalls.push({ title, options });
						return "Ship Friday";
					},
					input: async () => {
						throw new Error("unexpected");
					},
					notify: () => {},
				} as unknown as ExtensionContext["ui"],
			} as ExtensionContext;
			const answer = await requestPiAskPrompt(ctx, { question: "Ship or not?", options: [{ title: "Ship Friday" }] });
			expect(selectCalls).toHaveLength(1);
			expect(answer).toEqual({ content: "Ship Friday", selected: ["Ship Friday"] });
		});
	});

	/**
	 * Politeness: a live ask must not pop over the human actively typing. Real keystrokes via
	 * ctx.ui.onTerminalInput, not editor text content -- content can't distinguish "actively typing"
	 * from "a stale draft sitting there", and misses a mid-thought erase-and-resume. isRecentlyTyping
	 * is a plain synchronous check so the common (nobody typing) case never adds an await -- an
	 * unconditional await, even one that resolves immediately, still yields a microtask, which is
	 * enough for a signal aborted synchronously right after invoking requestPiAskPrompt to race past the
	 * deeper abort listener and get missed (caught live in this file's own "signal DOES cancel" test
	 * above once an unconditional wait was first added).
	 */
	describe("typing courtesy: waits out real keystroke activity before asking", () => {
		function fakeTypingUi(): { ui: PiHitlContext["ui"]; keystroke: () => void } {
			let handler: ((data: string) => unknown) | undefined;
			// A deliberately partial mock -- only onTerminalInput is exercised by this suite -- cast
			// once here rather than typing the whole function's return as `any`.
			const ui = {
				onTerminalInput: (h: (data: string) => unknown) => {
					handler = h;
					return () => {};
				},
			} as unknown as PiHitlContext["ui"];
			return { ui, keystroke: () => handler?.("x") };
		}

		it("isRecentlyTyping: false at rest, and false when onTerminalInput isn't available in this UI mode", () => {
			expect(isRecentlyTyping()).toBe(false);
			ensureTypingCourtesyTracking({} as unknown as PiHitlContext["ui"]);
			expect(isRecentlyTyping()).toBe(false);
		});

		it("isRecentlyTyping: true immediately after a real keystroke arrives through the tracked ui", () => {
			const { ui, keystroke } = fakeTypingUi();
			ensureTypingCourtesyTracking(ui);
			expect(isRecentlyTyping()).toBe(false);
			keystroke();
			expect(isRecentlyTyping()).toBe(true);
		});

		it("tracking is ambient, not per-ask: a keystroke observed before an ask starts still counts", () => {
			// The exact case this feature protects: typing already in progress when the tool call
			// begins, not just typing that starts after. ensureTypingCourtesyTracking is idempotent per
			// distinct ui instance, matching how it's actually attached once from session_start.
			const { ui, keystroke } = fakeTypingUi();
			ensureTypingCourtesyTracking(ui);
			keystroke();
			ensureTypingCourtesyTracking(ui); // a later ask's call site re-invoking it must not reset anything
			expect(isRecentlyTyping()).toBe(true);
		});

		it("waitForTypingCourtesy resolves once the required quiet gap has elapsed since the last keystroke", async () => {
			setTypingCourtesyTimingForTests({ pollMs: 5, initialQuietMs: 40, floorMs: 40, decayHorizonMs: 1000 });
			const { ui, keystroke } = fakeTypingUi();
			ensureTypingCourtesyTracking(ui);
			keystroke();
			let waitedMessage: string | undefined;
			const start = Date.now();
			await waitForTypingCourtesy({
				onUpdate: (update) => {
					const first = update.content?.[0];
					waitedMessage = first?.type === "text" ? first.text : undefined;
				},
			});
			expect(Date.now() - start).toBeGreaterThanOrEqual(35);
			expect(waitedMessage).toContain("finish typing");
		});

		it("a fresh keystroke mid-wait pushes the resolution out further -- true debounce, not a fixed timer from the first keystroke", async () => {
			setTypingCourtesyTimingForTests({ pollMs: 5, initialQuietMs: 60, floorMs: 60, decayHorizonMs: 10_000 });
			const { ui, keystroke } = fakeTypingUi();
			ensureTypingCourtesyTracking(ui);
			keystroke();
			const start = Date.now();
			setTimeout(() => keystroke(), 30); // resets the quiet gap before the first one would have elapsed
			await waitForTypingCourtesy({});
			expect(Date.now() - start).toBeGreaterThanOrEqual(85);
		});

		it("decays: the required quiet gap shrinks the longer someone types continuously, converging on the floor", async () => {
			// A steady 20ms drip of keystrokes: under the wide initial quiet gap (200ms) this would never
			// settle, but once decayed to the 5ms floor (well below the drip interval) a natural gap
			// between two keystrokes clears it -- proves the required gap actually shrinks over time,
			// not just that it eventually gives up. clearInterval is in a finally: this loop must never
			// leak into later tests by continuing to touch the shared keystroke clock past this test.
			setTypingCourtesyTimingForTests({ pollMs: 5, initialQuietMs: 200, floorMs: 5, decayHorizonMs: 150 });
			const { ui, keystroke } = fakeTypingUi();
			ensureTypingCourtesyTracking(ui);
			keystroke();
			const interval = setInterval(() => keystroke(), 20);
			const start = Date.now();
			try {
				await waitForTypingCourtesy({});
			} finally {
				clearInterval(interval);
			}
			expect(Date.now() - start).toBeGreaterThanOrEqual(90);
			expect(Date.now() - start).toBeLessThan(1000);
		});

		it("stops immediately when the tool call's own signal aborts mid-wait", async () => {
			setTypingCourtesyTimingForTests({ pollMs: 5, initialQuietMs: 5000, floorMs: 5000, decayHorizonMs: 10_000 });
			const { ui, keystroke } = fakeTypingUi();
			ensureTypingCourtesyTracking(ui);
			keystroke();
			const controller = new AbortController();
			setTimeout(() => controller.abort(), 20);
			const start = Date.now();
			await waitForTypingCourtesy({ signal: controller.signal });
			expect(Date.now() - start).toBeLessThan(500);
		});

		it("end-to-end through requestPiAskPrompt: the picker does not open while real keystrokes are still arriving", async () => {
			setTypingCourtesyTimingForTests({ pollMs: 5, initialQuietMs: 40, floorMs: 40, decayHorizonMs: 1000 });
			const tui = { terminal: { rows: 40 }, requestRender: () => {} } as unknown as TUI;
			let handler: ((data: string) => unknown) | undefined;
			let hostedAt = 0;
			const start = Date.now();
			const ctx = {
				cwd: "/tmp",
				hasUI: true,
				ui: {
					select: async () => {
						throw new Error("should not fall back to dialogs");
					},
					input: async () => {
						throw new Error("should not fall back to dialogs");
					},
					notify: () => {},
					theme,
					getEditorText: () => "",
					getEditorComponent: () => undefined,
					onTerminalInput: (h: (data: string) => unknown) => {
						handler = h;
						return () => {};
					},
					setEditorComponent: (factory: EditorFactory) => {
						if (!factory) return;
						hostedAt = Date.now() - start;
						const host = factory(tui, fakeEditorTheme, keybindings);
						host.handleInput(ENTER);
					},
				} as unknown as ExtensionContext["ui"],
			} as ExtensionContext;
			ensureTypingCourtesyTracking(ctx.ui);
			handler?.("x"); // simulates typing already in progress when the ask begins
			const answer = await requestPiAskPrompt(ctx, { question: "Ship or not?", options: [{ title: "Ship Friday" }] });
			expect(hostedAt).toBeGreaterThanOrEqual(35);
			expect(answer).toEqual({ content: "Ship Friday", selected: ["Ship Friday"] });
		});
	});
});

/**
 * Testing strategy for this generic rule (deliberately two tiers, not one):
 *
 * 1. shouldShowSectionSeparator/renderSectionSeparator are pure functions of plain values (row
 *    counts, line arrays, a width) with no dependency on `this.mode` or any other AskComponent
 *    state -- exhaustive table-driven coverage here proves the rule is genuinely mode-agnostic
 *    (the same function, same inputs -> same output, regardless of which branch of
 *    renderBudgetedLayout calls it) far more directly than inferring it from rendered output.
 *
 * 2. A real end-to-end render (through requestPiAskPrompt/AskComponent) still matters -- it's
 *    the only way to catch a wiring mistake (e.g. the right pure functions used, but with the
 *    wrong arguments, or never called at all). Scoped to select mode only: pi-tui's own Editor
 *    component (used by the freeform/comment modes) renders its own plain, corner-less
 *    `"─".repeat(width)` border line, which an end-to-end assertion cannot distinguish from this
 *    module's own separator by content shape alone -- exactly the ambiguity tier 1 exists to
 *    route around instead of fighting.
 */
describe("shouldShowSectionSeparator: the generic (mode-agnostic) gating rule for the visual boundary between the prompt pane and the mode pane", () => {
	it.each([
		[1, ["question"], ["1. Approve"], true],
		[0, ["question"], ["1. Approve"], false],
		[1, [], ["1. Approve"], false],
		[1, ["question"], [], false],
		[0, [], [], false],
		[2, ["question", "context line"], ["1. Approve", "2. Deny"], true],
	] as const)(
		"separatorRows=%p, promptPaneLines.length=%p's lines, modeLines=%p's lines -> %p",
		(separatorRows, promptPaneLines, modeLines, expected) => {
			expect(shouldShowSectionSeparator(separatorRows, promptPaneLines, modeLines)).toBe(expected);
		},
	);

	it("is false for a negative separatorRows too -- only a genuinely positive budget counts, not merely non-zero", () => {
		expect(shouldShowSectionSeparator(-1, ["question"], ["1. Approve"])).toBe(false);
	});
});

describe("renderSectionSeparator: a dim horizontal rule, pure and generic in its own right", () => {
	it("spans exactly the given width using only the dash character, wrapped through theme.fg('dim', ...)", () => {
		const calls: Array<{ color: string; text: string }> = [];
		const spyTheme = {
			...theme,
			fg: (color: string, text: string) => {
				calls.push({ color, text });
				return text;
			},
		} as Theme;
		expect(renderSectionSeparator(spyTheme, 10)).toBe("──────────");
		expect(calls).toEqual([{ color: "dim", text: "──────────" }]);
	});

	it.each([
		[1, "─"],
		[5, "─────"],
		[0, ""],
		[-1, ""],
		[-100, ""],
	])("width=%p -> %p (never throws or goes negative-length)", (width, expected) => {
		expect(renderSectionSeparator(theme, width)).toBe(expected);
	});
});

describe("the section separator, end to end through a real AskComponent (select mode only -- see the strategy note above for why)", () => {
	/** A line that is purely a rule: optionally framed by the box's own "│ "/" │" padding, never the
	 * outer box's own ╭/╮/╰/╯-cornered top/bottom border, and never real question/option text (which
	 * always contains letters). Generic across whatever exact width the box happens to render at --
	 * deliberately not tied to a hardcoded column count. */
	const isSectionSeparatorLine = (line: string) => /^[│\s]*─{5,}[│\s]*$/.test(line);

	async function captureIntegratedLines(
		rows: number,
		params: { question: string; context?: string; options: Array<{ title: string }> },
	): Promise<string[]> {
		const tui = { terminal: { rows }, requestRender: () => {} } as unknown as TUI;
		const base = interactiveCtx([]);
		let component: { render: (w: number) => string[]; handleInput: (data: string) => void } | undefined;
		const captureCtx = {
			...base,
			ui: {
				...base.ui,
				setEditorComponent: (factory: EditorFactory) => {
					if (!factory) return;
					component = factory(tui, fakeEditorTheme, keybindings);
				},
			},
		} as unknown as ExtensionContext;
		const pending = requestPiAskPrompt(captureCtx, { ...params, presentation: "integrated" });
		await new Promise((resolve) => setTimeout(resolve, 0));
		const lines = component!.render(100);
		component!.handleInput(ESCAPE); // cancel without submitting -- the captured lines are already in hand
		await pending;
		return lines;
	}

	it("appears strictly between the context text and the select list when both are shown and there's room", async () => {
		const lines = await captureIntegratedLines(40, {
			question: "Approve?",
			context: "Some background info about this request.",
			options: [{ title: "Approve" }, { title: "Deny" }],
		});
		const contextIndex = lines.findIndex((line) => line.includes("Some background info about this request."));
		const filterIndex = lines.findIndex((line) => line.includes("Filter:"));
		const separatorIndex = lines.findIndex(isSectionSeparatorLine);
		expect(contextIndex).toBeGreaterThanOrEqual(0);
		expect(filterIndex).toBeGreaterThan(contextIndex);
		expect(separatorIndex).toBeGreaterThan(contextIndex);
		expect(separatorIndex).toBeLessThan(filterIndex);
	});

	it("never appears when the layout budget is too tight to afford one, rather than a stray dash-only line squeezed in anyway", async () => {
		const lines = await captureIntegratedLines(8, {
			question: "Approve?",
			context: "Some background info about this request.",
			options: [{ title: "Approve" }, { title: "Deny" }],
		});
		expect(lines.some(isSectionSeparatorLine)).toBe(false);
	});

	it("still appears with only a bare question and no context -- the question line alone is enough of a prompt pane to separate from the choices", async () => {
		const lines = await captureIntegratedLines(40, { question: "Approve?", options: [{ title: "Approve" }, { title: "Deny" }] });
		const questionIndex = lines.findIndex((line) => line.includes("Approve?"));
		const filterIndex = lines.findIndex((line) => line.includes("Filter:"));
		const separatorIndex = lines.findIndex(isSectionSeparatorLine);
		expect(questionIndex).toBeGreaterThanOrEqual(0);
		expect(filterIndex).toBeGreaterThan(questionIndex);
		expect(separatorIndex).toBeGreaterThan(questionIndex);
		expect(separatorIndex).toBeLessThan(filterIndex);
	});
});
