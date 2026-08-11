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
 * registerVehicleTools()'s local-approval-prompt options, grouped out of
 * RegisterVehicleToolsOptions's own flat option list (see vehicle-pi.ts). Distinct from
 * RegisterVehicleToolsSafetyOptions (vehicle-safety.ts): this group only ever customizes HOW the
 * local approval prompt looks/behaves, never WHETHER an operation needs one in the first place.
 */
export interface RegisterVehicleToolsApprovalOptions {
	/**
	 * Host used for local approval HITL. `overlay` (default) blocks in a popup over
	 * scrollback; `integrated` replaces Pi's editor while preserving its draft,
	 * scrollback, and footer. RPC/headless contexts retain the native confirm fallback.
	 */
	readonly approvalPresentation?: PiHitlPresentation;
	/**
	 * Per-operation override for the local approval prompt's own title/message, shown by the
	 * approval-required retry dance's optional synchronous fast path (requestLocalApproval)
	 * and by the local /safety "ask" gate. Returning undefined (or omitting this option
	 * entirely, or the callback returning undefined for a given descriptor) falls back to
	 * the generic `Approve ${displayLabel}?` / raw-JSON-input prompt, unchanged.
	 *
	 * Exists for the same reason `rendering.renderers` exists for tool call/result rendering: a
	 * consumer with real UX investment in one operation's approval copy (e.g. a
	 * human-readable command preview, or a specific warning that applies only to one
	 * dangerous input shape) can supply it here instead of every caller seeing a raw JSON
	 * dump of the input. Does not change the server-side approval-required/capability
	 * protocol at all -- purely the local prompt's own copy.
	 */
	readonly approvalPrompt?: (descriptor: VehicleOperationDescriptor, input: unknown) => { title: string; message: string } | undefined;
	/**
	 * Overrides the actual local-approval HITL mechanism itself -- distinct from approvalPrompt
	 * above, which only ever customizes the plain yes/no prompt's title/message text. See
	 * LocalApprovalRequester's own doc comment.
	 */
	readonly requestApproval?: LocalApprovalRequester;
}

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
