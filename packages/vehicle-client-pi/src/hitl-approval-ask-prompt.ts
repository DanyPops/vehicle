/**
 * requestPiApprovalViaAskPrompt: a LocalApprovalRequester (see vehicle-pi.ts's
 * RegisterVehicleToolsOptions.requestApproval) built on requestPiAskPrompt's richer
 * searchable-select component, instead of hitl-prompt.ts's purpose-built, fixed two-item
 * ApprovalPromptComponent. Wire it in when a consumer wants that shared, richer component
 * instead of the plain yes/no dialog, e.g. because it already uses requestPiAskPrompt elsewhere
 * and wants one consistent HITL look.
 *
 * Presents three explicit choices -- Approve, Deny, Deny (add comment) -- rather than a blanket
 * post-selection comment prompt available regardless of which one is picked: a comment only ever
 * makes sense when denying ("I approve, and here's my reason" is not a real use case), so
 * Approve/Deny alone resolve immediately with no further prompt, and only "Deny (add comment)"
 * asks a second, genuinely optional question for the actual reason.
 *
 * Wire it in via `registerVehicleTools(pi, client, { requestApproval: requestPiApprovalViaAskPrompt })`
 * (or the registerVehicleToolsWhenReady equivalent).
 */

import { requestPiAskPrompt } from "./hitl-ask-prompt.js";
import type { PiApprovalAnswer } from "./hitl-prompt.js";
import type { LocalApprovalRequester } from "./vehicle-pi.js";

const APPROVE_OPTION_TITLE = "Approve";
const DENY_OPTION_TITLE = "Deny";
const DENY_WITH_COMMENT_OPTION_TITLE = "Deny (add comment)";

/**
 * requestPiAskPrompt's own toAskAnswer (hitl-ask-prompt.ts) folds an optional comment into
 * `content` as ``${selections.join(", ")} — ${comment}`` -- PiAskPromptAnswer carries no separate
 * field to read it back from. Recovers it from that exact, known format; returns undefined when
 * `content` is the bare selection join (no comment was given).
 *
 * No longer used by requestPiApprovalViaAskPrompt itself (its own comment collection is now a
 * dedicated freeform follow-up, not requestPiAskPrompt's blanket allowComment toggle) -- kept
 * exported as a small, generic, standalone utility for any other caller of requestPiAskPrompt's
 * own allowComment-shaped answers, and for its own direct unit coverage below.
 */
export function extractAskPromptComment(content: string, selected: readonly string[]): string | undefined {
	const prefix = `${selected.join(", ")} — `;
	return content.startsWith(prefix) ? content.slice(prefix.length) : undefined;
}

export const requestPiApprovalViaAskPrompt: LocalApprovalRequester = async (context, params) => {
	const answer = await requestPiAskPrompt(context, {
		question: params.prompt.title,
		context: params.prompt.message,
		options: [{ title: APPROVE_OPTION_TITLE }, { title: DENY_OPTION_TITLE }, { title: DENY_WITH_COMMENT_OPTION_TITLE }],
		allowMultiple: false,
		allowFreeform: false,
		allowComment: false,
		presentation: params.presentation,
		signal: params.signal,
		// params.timeoutMs is always already resolved by requestLocalApproval (the configured
		// RegisterVehicleToolsOptions.approvalPromptTimeoutMs, or its own built-in default) -- never
		// this file's own hardcoded value, so a consumer's timeout choice applies uniformly regardless
		// of which LocalApprovalRequester it wires in. 0/negative means "block indefinitely", passed
		// straight through to requestPiAskPrompt's own hostDualPresentationComponent timer.
		timeout: params.timeoutMs,
	});
	// Cancel, timeout, no UI, or (defensively, since allowFreeform is false) a freeform response
	// with no selection all mean "no decision was made" -- deny, never approve, matching
	// requestPiApproval's own null-on-any-failure contract.
	if (!answer?.selected?.length) return null satisfies PiApprovalAnswer | null;
	const selected = answer.selected[0];
	if (selected === APPROVE_OPTION_TITLE) return { approved: true };
	if (selected === DENY_OPTION_TITLE) return { approved: false };
	// DENY_WITH_COMMENT_OPTION_TITLE: a second, genuinely freeform ask for the actual reason --
	// reuses requestPiAskPrompt itself (not a direct ctx.ui.input call) so the comment step gets
	// whichever hosting mode (overlay/integrated/dialog fallback) the first ask already used,
	// instead of always falling back to the plain dialog for this one step specifically.
	const commentAnswer = await requestPiAskPrompt(context, {
		question: "Reason for denial (optional)",
		options: [],
		allowFreeform: true,
		presentation: params.presentation,
		signal: params.signal,
		timeout: params.timeoutMs,
	});
	const comment = commentAnswer?.content?.trim();
	return { approved: false, ...(comment ? { comment } : {}) };
};
