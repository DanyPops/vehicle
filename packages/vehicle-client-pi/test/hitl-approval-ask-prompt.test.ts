import { describe, expect, it } from "bun:test";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { extractAskPromptComment, requestPiApprovalViaAskPrompt } from "../src/hitl-approval-ask-prompt.ts";
import type { LocalApprovalRequestParams } from "../src/vehicle-pi.ts";

function params(overrides: Partial<LocalApprovalRequestParams> = {}): LocalApprovalRequestParams {
	return {
		descriptor: { name: "issue.create", version: 1, effect: "external-write" } as LocalApprovalRequestParams["descriptor"],
		input: { backend: "github" },
		prompt: { title: "Approve Issue Create?", message: "issue.create@1 (external-write effect) requests approval." },
		timeoutMs: 2 * 60_000,
		...overrides,
	};
}

describe("extractAskPromptComment", () => {
	it("recovers the comment toAskAnswer folded into content", () => {
		expect(extractAskPromptComment("Approve — looks good to me", ["Approve"])).toBe("looks good to me");
	});

	it("returns undefined when content is the bare selection join -- no comment was given", () => {
		expect(extractAskPromptComment("Approve", ["Approve"])).toBeUndefined();
	});

	it("joins multiple selections with the same separator requestPiAskPrompt itself uses", () => {
		expect(extractAskPromptComment("Approve, Deny — mixed batch", ["Approve", "Deny"])).toBe("mixed batch");
	});
});

describe("requestPiApprovalViaAskPrompt", () => {
	it("presents Approve/Deny through the dialog fallback (ctx.ui.select) in RPC/headless mode", async () => {
		const selectCalls: Array<{ title: string; options: string[] }> = [];
		const ctx = {
			hasUI: true,
			ui: {
				select: async (title: string, options: string[]) => {
					selectCalls.push({ title, options });
					return "Approve";
				},
				input: async () => undefined,
				notify: () => {},
			},
		} as unknown as ExtensionContext;

		const answer = await requestPiApprovalViaAskPrompt(ctx, params());

		// No freeform sentinel: requestPiApprovalViaAskPrompt always disables freeform. The prompt's
		// message rides along as requestPiAskPrompt's own "Context:" section (see the dedicated test
		// below for that exact formatting). Three real options -- Approve/Deny alone never trigger a
		// second, comment-collecting ask; only "Deny (add comment)" does (see its own dedicated test).
		expect(selectCalls).toEqual([
			{
				title: "Approve Issue Create?\n\nContext:\nissue.create@1 (external-write effect) requests approval.",
				options: ["Approve", "Deny", "Deny (add comment)"],
			},
		]);
		expect(answer).toEqual({ approved: true });
	});

	it("resolves denied when the human picks Deny", async () => {
		const ctx = {
			hasUI: true,
			ui: { select: async () => "Deny", input: async () => undefined, notify: () => {} },
		} as unknown as ExtensionContext;

		expect(await requestPiApprovalViaAskPrompt(ctx, params())).toEqual({ approved: false });
	});

	it("plain Deny resolves immediately with no comment prompt at all -- a comment only ever makes sense on denial-with-reason", async () => {
		const inputCalls: unknown[] = [];
		const ctx = {
			hasUI: true,
			ui: {
				select: async () => "Deny",
				input: async (...args: unknown[]) => {
					inputCalls.push(args);
					return undefined;
				},
				notify: () => {},
			},
		} as unknown as ExtensionContext;

		expect(await requestPiApprovalViaAskPrompt(ctx, params())).toEqual({ approved: false });
		expect(inputCalls).toEqual([]); // no second ask at all for plain Deny
	});

	it('"Deny (add comment)" asks a genuinely separate freeform question and threads the answer through as PiApprovalAnswer.comment', async () => {
		const selectCalls: unknown[] = [];
		const inputCalls: string[] = [];
		const ctx = {
			hasUI: true,
			ui: {
				select: async (title: string) => {
					selectCalls.push(title);
					return "Deny (add comment)";
				},
				input: async (prompt: string) => {
					inputCalls.push(prompt);
					return "This backend doesn't have field X configured yet.";
				},
				notify: () => {},
			},
		} as unknown as ExtensionContext;

		expect(await requestPiApprovalViaAskPrompt(ctx, params())).toEqual({
			approved: false,
			comment: "This backend doesn't have field X configured yet.",
		});
		expect(selectCalls).toHaveLength(1); // the original Approve/Deny/Deny-with-comment choice
		expect(inputCalls).toHaveLength(1); // the dedicated freeform reason ask -- a genuinely separate question
		expect(inputCalls[0]).toContain("Reason for denial");
	});

	it('"Deny (add comment)" with an empty/whitespace-only reason still resolves denied, just without a comment', async () => {
		const ctx = {
			hasUI: true,
			ui: {
				select: async () => "Deny (add comment)",
				input: async () => "   ",
				notify: () => {},
			},
		} as unknown as ExtensionContext;

		expect(await requestPiApprovalViaAskPrompt(ctx, params())).toEqual({ approved: false });
	});

	it("passes the resolved prompt's title/message through as question/context", async () => {
		let seenTitle = "";
		const ctx = {
			hasUI: true,
			ui: {
				select: async (title: string) => {
					seenTitle = title;
					return "Approve";
				},
				input: async () => undefined,
				notify: () => {},
			},
		} as unknown as ExtensionContext;

		await requestPiApprovalViaAskPrompt(
			ctx,
			params({ prompt: { title: "Run the dangerous thing?", message: 'About to run with {"value":"go"}' } }),
		);
		expect(seenTitle).toBe('Run the dangerous thing?\n\nContext:\nAbout to run with {"value":"go"}');
	});

	it("denies (returns null) on cancel -- never fabricates an approval", async () => {
		const ctx = {
			hasUI: true,
			ui: { select: async () => undefined, input: async () => undefined, notify: () => {} },
		} as unknown as ExtensionContext;

		expect(await requestPiApprovalViaAskPrompt(ctx, params())).toBeNull();
	});

	it("denies (returns null) when there is no interactive UI at all", async () => {
		const ctx = { hasUI: false, ui: {} } as unknown as ExtensionContext;
		expect(await requestPiApprovalViaAskPrompt(ctx, params())).toBeNull();
	});

	it("passes params.timeoutMs straight through to the dialog fallback's own timeout option, never a hardcoded value of its own", async () => {
		const dialogOpts: unknown[] = [];
		const ctx = {
			hasUI: true,
			ui: {
				select: async (_title: string, _options: string[], opts: unknown) => {
					dialogOpts.push(opts);
					return "Approve";
				},
				input: async () => undefined,
				notify: () => {},
			},
		} as unknown as ExtensionContext;

		await requestPiApprovalViaAskPrompt(ctx, params({ timeoutMs: 45_000 }));
		expect(dialogOpts).toEqual([{ timeout: 45_000 }]);
	});

	it("a timeoutMs of 0 (block indefinitely) reaches the dialog fallback as no timeout option at all, matching hostDualPresentationComponent's own contract", async () => {
		const dialogOpts: unknown[] = [];
		const ctx = {
			hasUI: true,
			ui: {
				select: async (_title: string, _options: string[], opts: unknown) => {
					dialogOpts.push(opts);
					return "Approve";
				},
				input: async () => undefined,
				notify: () => {},
			},
		} as unknown as ExtensionContext;

		await requestPiApprovalViaAskPrompt(ctx, params({ timeoutMs: 0 }));
		expect(dialogOpts).toEqual([undefined]);
	});
});
