import { describe, expect, it } from "bun:test";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { extractAskPromptComment, requestPiApprovalViaAskPrompt } from "../src/hitl-approval-ask-prompt.ts";
import type { LocalApprovalRequestParams } from "../src/vehicle-pi.ts";

function params(overrides: Partial<LocalApprovalRequestParams> = {}): LocalApprovalRequestParams {
	return {
		descriptor: { name: "issue.create", version: 1, effect: "external-write" } as LocalApprovalRequestParams["descriptor"],
		input: { backend: "github" },
		prompt: { title: "Approve Issue Create?", message: "issue.create@1 (external-write effect) requests approval." },
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
		// below for that exact formatting).
		expect(selectCalls).toEqual([
			{
				title: "Approve Issue Create?\n\nContext:\nissue.create@1 (external-write effect) requests approval.",
				options: ["Approve", "Deny"],
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

	it("threads an optional comment through onto the resolved PiApprovalAnswer", async () => {
		const ctx = {
			hasUI: true,
			ui: {
				select: async () => "Deny",
				input: async () => "This backend doesn't have field X configured yet.",
				notify: () => {},
			},
		} as unknown as ExtensionContext;

		expect(await requestPiApprovalViaAskPrompt(ctx, params())).toEqual({
			approved: false,
			comment: "This backend doesn't have field X configured yet.",
		});
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
});
