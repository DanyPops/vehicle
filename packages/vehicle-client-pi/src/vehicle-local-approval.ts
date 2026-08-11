import type { VehicleOperationDescriptor } from "@danypops/vehicle-core";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { type PiApprovalAnswer, type PiHitlPresentation, requestPiApproval } from "./hitl-prompt.js";
import { displayLabel, formatJson, operationKey } from "./vehicle-pi-primitives.js";

/**
 * The local, optional synchronous half of the Approval Gate, split out of vehicle-pi.ts's own
 * kitchen-sink module -- distinct from safety classification, manifest handshaking, and job
 * polling. VehicleRegistry always records an approval.requested event first (durable, works even
 * with no UI at all); this is the fast path layered on top when ctx.hasUI says one is actually
 * possible. Denies (never throws) on any failure -- a UI error must fail closed, not silently
 * grant.
 */

/** How long a local HITL prompt stays open before auto-denying -- deliberately shorter than the registry's own DEFAULT_APPROVAL_TIMEOUT_MS so a request never lapses server-side while still mid-prompt locally. */
const LOCAL_APPROVAL_PROMPT_TIMEOUT_MS = 2 * 60_000;

/**
 * The resolved title/message a local approval prompt is about to show -- either options.approvalPrompt's
 * own override, or the generic `Approve ${displayLabel}?` / raw-JSON-input default. Always fully resolved
 * by the time a LocalApprovalRequester sees it, unlike RegisterVehicleToolsOptions.approvalPrompt's own
 * return type, which is allowed to say undefined for "use the default".
 */
export interface LocalApprovalPrompt {
	readonly title: string;
	readonly message: string;
}

export interface LocalApprovalRequestParams {
	readonly descriptor: VehicleOperationDescriptor;
	readonly input: unknown;
	readonly signal?: AbortSignal;
	readonly presentation?: PiHitlPresentation;
	readonly prompt: LocalApprovalPrompt;
}

/**
 * Overrides the actual local-approval HITL mechanism itself -- distinct from options.approvalPrompt,
 * which only ever customizes the plain yes/no prompt's title/message text. A consumer wanting a
 * genuinely richer interaction (e.g. Approve/Deny presented via requestPiAskPrompt instead of
 * requestPiApproval's fixed two-item select, so a searchable/multi-option/freeform-reason shape is
 * possible) supplies this instead. Same contract as requestPiApproval itself: null (or a resolved
 * `{ approved: false }`) means denied; requestLocalApproval's own callers already treat any
 * non-approved answer, including null, identically.
 */
export type LocalApprovalRequester = (context: ExtensionContext, params: LocalApprovalRequestParams) => Promise<PiApprovalAnswer | null>;

/**
 * The local, fast-path half of the Approval Gate: VehicleRegistry always
 * records an approval.requested event first (durable, works even with no
 * UI at all); this is the optional synchronous prompt layered on top when
 * ctx.hasUI says one is actually possible. Denies (never throws) on any
 * failure -- a UI error must fail closed, not silently grant.
 */
export async function requestLocalApproval(
	context: ExtensionContext,
	descriptor: VehicleOperationDescriptor,
	input: unknown,
	signal: AbortSignal | undefined,
	presentation: PiHitlPresentation | undefined,
	promptOverride: { title: string; message: string } | undefined,
	requester: LocalApprovalRequester | undefined,
): Promise<PiApprovalAnswer | null> {
	const { title, message } = promptOverride ?? {
		title: `Approve ${displayLabel(descriptor)}?`,
		message: `${operationKey(descriptor)} (${descriptor.effect} effect) requests approval before it can run.\n\nInput:\n${formatJson(input)}`,
	};
	if (requester) return requester(context, { descriptor, input, signal, presentation, prompt: { title, message } });
	return requestPiApproval(context, { title, message, presentation, signal, timeout: LOCAL_APPROVAL_PROMPT_TIMEOUT_MS });
}
