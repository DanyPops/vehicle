/**
 * requestPiApprovalViaAskPrompt: a LocalApprovalRequester (see vehicle-pi.ts's
 * RegisterVehicleToolsOptions.requestApproval) built on requestPiAskPrompt's richer
 * searchable-select + optional-comment component, instead of hitl-prompt.ts's purpose-built,
 * fixed two-item ApprovalPromptComponent. Functionally equivalent for the common case
 * (Approve/Deny, optional comment via the same ctrl+g toggle, identical dual-host
 * integrated/overlay presentation and typing-courtesy behavior) -- wire it in when a consumer
 * wants that shared, richer component instead of the plain yes/no dialog, e.g. because it
 * already uses requestPiAskPrompt elsewhere and wants one consistent HITL look.
 *
 * Wire it in via `registerVehicleTools(pi, client, { requestApproval: requestPiApprovalViaAskPrompt })`
 * (or the registerVehicleToolsWhenReady equivalent).
 */

import { requestPiAskPrompt } from "./hitl-ask-prompt.js";
import type { PiApprovalAnswer } from "./hitl-prompt.js";
import type { LocalApprovalRequester } from "./vehicle-pi.js";

const APPROVE_OPTION_TITLE = "Approve";
const DENY_OPTION_TITLE = "Deny";

/**
 * Mirrors vehicle-pi.ts's own (unexported) LOCAL_APPROVAL_PROMPT_TIMEOUT_MS -- deliberately
 * shorter than the registry's own DEFAULT_APPROVAL_TIMEOUT_MS so a request never lapses
 * server-side while still mid-prompt locally. Kept as a separate constant here rather than
 * importing the private one: this file's timeout is its own implementation detail of the
 * requestPiAskPrompt-based prompt, not a shared value the two need to stay byte-identical on.
 */
const ASK_PROMPT_APPROVAL_TIMEOUT_MS = 2 * 60_000;

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
		presentation: params.presentation,
		signal: params.signal,
		timeout: ASK_PROMPT_APPROVAL_TIMEOUT_MS,
	});
	// Cancel, timeout, no UI, or (defensively, since allowFreeform is false) a freeform response
	// with no selection all mean "no decision was made" -- deny, never approve, matching
	// requestPiApproval's own null-on-any-failure contract.
	if (!answer?.selected?.length) return null satisfies PiApprovalAnswer | null;
	const approved = answer.selected[0] === APPROVE_OPTION_TITLE;
	const comment = extractAskPromptComment(answer.content, answer.selected);
	return { approved, ...(comment ? { comment } : {}) };
};
