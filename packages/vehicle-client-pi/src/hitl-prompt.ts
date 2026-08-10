import { DynamicBorder, type ExtensionContext, getSelectListTheme, type Theme } from "@earendil-works/pi-coding-agent";
import {
	type Component,
	Container,
	type EditorComponent,
	type EditorTheme,
	Input,
	type KeybindingsManager,
	SelectList,
	Text,
	type TUI,
} from "@earendil-works/pi-tui";

export type PiHitlPresentation = "integrated" | "overlay";

const MAX_APPROVAL_COMMENT_CHARS = 2_000;

const DUAL_HOST_OVERLAY_OPTIONS = { anchor: "center", width: "80%", minWidth: 40, maxHeight: "80%", margin: 1 } as const;

/** Hosts any component built from (tui, theme, keybindings, done) in Pi's input editor, preserving
 * the human's outgoing draft verbatim -- the same wrapping both the approval prompt and the richer
 * ask prompt need, extracted rather than duplicated. */
class PreservedDraftEditorHost implements EditorComponent {
	constructor(
		private readonly inner: Component,
		private readonly preservedText: string,
	) {}
	getText(): string {
		return this.preservedText;
	}
	setText(_text: string): void {}
	render(width: number): string[] {
		return this.inner.render(width);
	}
	handleInput(data: string): void {
		this.inner.handleInput?.(data);
	}
	invalidate(): void {
		this.inner.invalidate?.();
	}
}

type DualHostComponentFactory<TAnswer> = (
	tui: TUI,
	theme: Theme,
	keybindings: KeybindingsManager,
	done: (answer: TAnswer | null) => void,
) => Component;

/** Shared `overlay` host: a blocking popup over the transcript via `ctx.ui.custom`. */
async function hostDualPresentationOverlay<TAnswer>(
	context: PiHitlContext,
	buildComponent: DualHostComponentFactory<TAnswer>,
	signal: AbortSignal | undefined,
	timeout: number | undefined,
): Promise<TAnswer | null> {
	let finishFromOutside: ((answer: TAnswer | null) => void) | undefined;
	const answer = context.ui.custom<TAnswer | null>(
		(tui, theme, keybindings, done) => {
			let settled = false;
			const finish = (result: TAnswer | null) => {
				if (settled) return;
				settled = true;
				done(result);
			};
			finishFromOutside = finish;
			return buildComponent(tui, theme, keybindings, finish);
		},
		{ overlay: true, overlayOptions: DUAL_HOST_OVERLAY_OPTIONS },
	);
	const abort = () => finishFromOutside?.(null);
	signal?.addEventListener("abort", abort, { once: true });
	const timer = timeout && timeout > 0 ? setTimeout(() => finishFromOutside?.(null), timeout) : undefined;
	try {
		return (await answer) ?? null;
	} finally {
		if (timer) clearTimeout(timer);
		signal?.removeEventListener("abort", abort);
	}
}

/** Shared `integrated` host: replaces Pi's input editor via `ctx.ui.setEditorComponent`, restoring
 * the exact previous factory once answered. `ctx.ui.custom`'s factory only receives an
 * `EditorTheme` (borderColor + selectList) -- nowhere near a component's real dependency on the
 * full `Theme` surface -- so the real, rich `context.ui.theme` is captured here instead. */
function hostDualPresentationIntegrated<TAnswer>(
	context: PiHitlContext,
	buildComponent: DualHostComponentFactory<TAnswer>,
	signal: AbortSignal | undefined,
	timeout: number | undefined,
): Promise<TAnswer | null> {
	const previousFactory = context.ui.getEditorComponent();
	const preservedText = context.ui.getEditorText();
	const theme = context.ui.theme;
	return new Promise((resolve) => {
		let settled = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const abort = () => finish(null);
		const finish = (answer: TAnswer | null) => {
			if (settled) return;
			settled = true;
			if (timer) clearTimeout(timer);
			signal?.removeEventListener("abort", abort);
			context.ui.setEditorComponent(previousFactory);
			resolve(answer);
		};
		signal?.addEventListener("abort", abort, { once: true });
		if (timeout && timeout > 0) timer = setTimeout(() => finish(null), timeout);
		context.ui.setEditorComponent((tui: TUI, _editorTheme: EditorTheme, keybindings: KeybindingsManager) => {
			const component = buildComponent(tui, theme, keybindings, finish);
			return new PreservedDraftEditorHost(component, preservedText);
		});
	});
}

/**
 * Presents any component in whichever of Pi's two supported HITL hosts `presentation` requests --
 * `overlay` needs `ctx.mode === "tui"` and `ctx.ui.custom`; `integrated` needs editor-replacement
 * support. Returns `undefined` (not `null`) when neither host is available, so a caller can fall
 * back to its own native prompt (e.g. `ctx.ui.confirm`) instead of treating a missing host the
 * same as a real cancel.
 */
export async function hostDualPresentationComponent<TAnswer>(
	context: PiHitlContext,
	presentation: PiHitlPresentation,
	buildComponent: DualHostComponentFactory<TAnswer>,
	signal: AbortSignal | undefined,
	timeout: number | undefined,
): Promise<TAnswer | null | undefined> {
	if (presentation === "overlay" && context.mode === "tui" && typeof context.ui.custom === "function") {
		return hostDualPresentationOverlay(context, buildComponent, signal, timeout);
	}
	if (
		presentation === "integrated" &&
		typeof context.ui.setEditorComponent === "function" &&
		typeof context.ui.getEditorComponent === "function" &&
		typeof context.ui.getEditorText === "function"
	) {
		return hostDualPresentationIntegrated(context, buildComponent, signal, timeout);
	}
	return undefined;
}

export interface PiApprovalPromptOptions {
	readonly title: string;
	readonly message: string;
	readonly presentation?: PiHitlPresentation;
	readonly signal?: AbortSignal;
	readonly timeout?: number;
}

export interface PiApprovalAnswer {
	readonly approved: boolean;
	readonly comment?: string;
}

export type PiHitlContext = Pick<ExtensionContext, "hasUI" | "mode" | "ui">;

class ApprovalPromptComponent {
	private readonly select = new SelectList(
		[
			{ value: "approve", label: "Approve", description: "Allow this operation once" },
			{ value: "deny", label: "Deny", description: "Do not run this operation" },
		],
		2,
		getSelectListTheme(),
	);
	private readonly commentInput = new Input();
	private editingComment = false;
	private comment = "";

	constructor(
		private readonly title: string,
		private readonly message: string,
		private readonly tui: TUI,
		private readonly theme: Theme,
		private readonly done: (answer: PiApprovalAnswer | null) => void,
	) {
		this.select.onSelect = (item) => this.done({ approved: item.value === "approve", ...(this.comment ? { comment: this.comment } : {}) });
		this.select.onCancel = () => this.done(null);
		this.commentInput.onSubmit = (value) => {
			this.comment = value.trim().slice(0, MAX_APPROVAL_COMMENT_CHARS);
			this.editingComment = false;
			this.tui.requestRender();
		};
		this.commentInput.onEscape = () => {
			this.editingComment = false;
			this.tui.requestRender();
		};
	}

	render(width: number): string[] {
		const container = new Container();
		container.addChild(new DynamicBorder((text) => this.theme.fg("accent", text)));
		container.addChild(new Text(this.theme.fg("accent", this.theme.bold(this.title)), 1, 0));
		container.addChild(new Text(this.message, 1, 1));
		if (this.editingComment) {
			container.addChild(new Text(this.theme.fg("dim", "Optional reason/comment:"), 1, 0));
			container.addChild(this.commentInput);
			container.addChild(new Text(this.theme.fg("dim", "enter save  •  esc back"), 1, 0));
		} else {
			container.addChild(this.select);
			const commentState = this.comment ? `c edit comment (${this.comment.length} chars)` : "c add optional comment";
			container.addChild(new Text(this.theme.fg("dim", `↑↓ choose  •  enter confirm  •  ${commentState}  •  esc cancel`), 1, 0));
		}
		container.addChild(new DynamicBorder((text) => this.theme.fg("accent", text)));
		return container.render(width);
	}

	handleInput(data: string): void {
		if (this.editingComment) this.commentInput.handleInput(data);
		else if (data === "c") {
			this.editingComment = true;
			this.commentInput.setValue(this.comment);
		} else this.select.handleInput(data);
		this.tui.requestRender();
	}

	invalidate(): void {
		this.select.invalidate();
		this.commentInput.invalidate();
	}
}

/**
 * Presents one shared approval experience in either of Pi's supported HITL hosts, via the shared
 * `hostDualPresentationComponent`. RPC/headless or partial UI implementations retain the native
 * confirm fallback.
 */
export async function requestPiApproval(context: PiHitlContext, options: PiApprovalPromptOptions): Promise<PiApprovalAnswer | null> {
	if (!context.hasUI || options.signal?.aborted) return null;
	const presentation = options.presentation ?? "overlay";
	const hosted = await hostDualPresentationComponent<PiApprovalAnswer>(
		context,
		presentation,
		(tui, theme, _keybindings, done) => new ApprovalPromptComponent(options.title, options.message, tui, theme, done),
		options.signal,
		options.timeout,
	);
	if (hosted !== undefined) return hosted;
	try {
		const approved = await context.ui.confirm(options.title, options.message, { signal: options.signal, timeout: options.timeout });
		return { approved };
	} catch {
		return null;
	}
}
