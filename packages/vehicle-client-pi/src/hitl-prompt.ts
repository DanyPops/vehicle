import { DynamicBorder, type ExtensionContext, getSelectListTheme, type Theme } from "@earendil-works/pi-coding-agent";
import {
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

class ApprovalEditorHost implements EditorComponent {
	constructor(
		private readonly prompt: ApprovalPromptComponent,
		private readonly preservedText: string,
	) {}
	getText(): string {
		return this.preservedText;
	}
	setText(_text: string): void {}
	render(width: number): string[] {
		return this.prompt.render(width);
	}
	handleInput(data: string): void {
		this.prompt.handleInput(data);
	}
	invalidate(): void {
		this.prompt.invalidate();
	}
}

async function hostOverlay(context: PiHitlContext, options: PiApprovalPromptOptions): Promise<PiApprovalAnswer | null> {
	let finishFromOutside: ((answer: PiApprovalAnswer | null) => void) | undefined;
	const answer = context.ui.custom<PiApprovalAnswer | null>(
		(tui, theme, _keybindings, done) => {
			let settled = false;
			const finish = (result: PiApprovalAnswer | null) => {
				if (settled) return;
				settled = true;
				done(result);
			};
			finishFromOutside = finish;
			return new ApprovalPromptComponent(options.title, options.message, tui, theme, finish);
		},
		{
			overlay: true,
			overlayOptions: { anchor: "center", width: "80%", minWidth: 40, maxHeight: "80%", margin: 1 },
		},
	);
	const abort = () => finishFromOutside?.(null);
	options.signal?.addEventListener("abort", abort, { once: true });
	const timeout = options.timeout && options.timeout > 0 ? setTimeout(() => finishFromOutside?.(null), options.timeout) : undefined;
	try {
		return await answer;
	} finally {
		if (timeout) clearTimeout(timeout);
		options.signal?.removeEventListener("abort", abort);
	}
}

function hostIntegrated(context: PiHitlContext, options: PiApprovalPromptOptions): Promise<PiApprovalAnswer | null> {
	const previousFactory = context.ui.getEditorComponent();
	const preservedText = context.ui.getEditorText();
	return new Promise((resolve) => {
		let settled = false;
		let timeout: ReturnType<typeof setTimeout> | undefined;
		const abort = () => finish(null);
		const finish = (answer: PiApprovalAnswer | null) => {
			if (settled) return;
			settled = true;
			if (timeout) clearTimeout(timeout);
			options.signal?.removeEventListener("abort", abort);
			context.ui.setEditorComponent(previousFactory);
			resolve(answer);
		};
		options.signal?.addEventListener("abort", abort, { once: true });
		if (options.timeout && options.timeout > 0) timeout = setTimeout(() => finish(null), options.timeout);
		context.ui.setEditorComponent(
			(tui: TUI, _editorTheme: EditorTheme, _keybindings: KeybindingsManager) =>
				new ApprovalEditorHost(new ApprovalPromptComponent(options.title, options.message, tui, context.ui.theme, finish), preservedText),
		);
	});
}

/**
 * Presents one shared approval experience in either of Pi's supported HITL hosts.
 * RPC/headless or partial UI implementations retain the native confirm fallback.
 */
export async function requestPiApproval(context: PiHitlContext, options: PiApprovalPromptOptions): Promise<PiApprovalAnswer | null> {
	if (!context.hasUI || options.signal?.aborted) return null;
	const presentation = options.presentation ?? "overlay";
	if (presentation === "overlay" && context.mode === "tui" && typeof context.ui.custom === "function") {
		return hostOverlay(context, options);
	}
	if (
		presentation === "integrated" &&
		typeof context.ui.setEditorComponent === "function" &&
		typeof context.ui.getEditorComponent === "function" &&
		typeof context.ui.getEditorText === "function"
	) {
		return hostIntegrated(context, options);
	}
	try {
		const approved = await context.ui.confirm(options.title, options.message, { signal: options.signal, timeout: options.timeout });
		return { approved };
	} catch {
		return null;
	}
}
