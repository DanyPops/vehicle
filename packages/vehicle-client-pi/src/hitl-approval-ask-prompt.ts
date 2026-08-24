/**
 * requestPiApprovalViaAskPrompt: a LocalApprovalRequester (see vehicle-pi.ts's
 * RegisterVehicleToolsOptions.requestApproval) built on requestPiAskPrompt's richer
 * searchable-select component, instead of hitl-prompt.ts's purpose-built, fixed two-item
 * ApprovalPromptComponent. Wire it in when a consumer wants that shared, richer component
 * instead of the plain yes/no dialog, e.g. because it already uses requestPiAskPrompt elsewhere
 * and wants one consistent HITL look.
 *
 * Two options -- Approve, Deny -- with the optional comment editor toggled by Tab rather than
 * requestPiAskPrompt's own ctrl+g default: Tab reads naturally as "add detail to my current
 * choice" (and shows up in the component's own hint line as e.g. "tab to comment" once hovering
 * Deny), matching a real, observed preference for a comment step that appears inline on demand
 * rather than a third, always-visible "Deny (with comment)" menu row. Repurposing Tab here means
 * this dialog's own down-navigation loses Tab as an alias (requestPiAskPrompt's own default binds
 * `Key.tab`/`Key.shift("tab")` to select-down/up) -- arrow keys (and vim-style j/k) still work
 * unchanged; only this specific approval prompt trades Tab-as-navigation for Tab-as-comment.
 *
 * Wire it in via `registerVehicleTools(pi, client, { requestApproval: requestPiApprovalViaAskPrompt })`
 * (or the registerVehicleToolsWhenReady equivalent).
 */

import { requestPiAskPrompt } from "./hitl-ask-prompt.js";
import type { PiApprovalAnswer } from "./hitl-prompt.js";
import type { LocalApprovalRequester } from "./vehicle-pi.js";

const APPROVE_OPTION_TITLE = "Approve";
const DENY_OPTION_TITLE = "Deny";
const COMMENT_TOGGLE_KEY = "tab";

/**
 * requestPiAskPrompt's own toAskAnswer (hitl-ask-prompt.ts) folds an optional comment into
 * `content` as ``${selections.join(", ")} — ${comment}`` -- PiAskPromptAnswer carries no separate
 * field to read it back from. Recovers it from that exact, known format; returns undefined when
 * `content` is the bare selection join (no comment was given). Exported for its own direct unit
 * coverage rather than only indirectly through requestPiApprovalViaAskPrompt.
 */
export function extractAskPromptComment(content: string, selected: readonly string[]): string | undefined {
	const prefix = `${selected.join(", ")} — `;
	return content.startsWith(prefix) ? content.slice(prefix.length) : undefined;
}

export const requestPiApprovalViaAskPrompt: LocalApprovalRequester = async (context, params) => {
	const answer = await requestPiAskPrompt(context, {
		question: params.prompt.title,
		context: params.prompt.message,
		options: [{ title: APPROVE_OPTION_TITLE }, { title: DENY_OPTION_TITLE }],
		allowMultiple: false,
		allowFreeform: false,
		allowComment: true,
		commentToggleKey: COMMENT_TOGGLE_KEY,
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
	const approved = answer.selected[0] === APPROVE_OPTION_TITLE;
	const comment = extractAskPromptComment(answer.content, answer.selected);
	return { approved, ...(comment ? { comment } : {}) };
};
