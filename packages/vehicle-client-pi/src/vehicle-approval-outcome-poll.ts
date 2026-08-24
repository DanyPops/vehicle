/**
 * Push half of the Approval Gate's outcome-visibility story -- vehicle-server's own
 * vehicle.approval.status (approval-policy.ts) is the pull half: it lets a caller look up one
 * specific requestId's outcome, but nothing calls it automatically. Without this, a human's
 * decision (and any comment) sits there resolved and durable, invisible to the agent until it
 * happens to think to ask about that exact id again -- exactly the gap RegisterVehicleToolsOptions'
 * own onApprovalPending hook exists to close: it fires with a requestId the instant a gated call's
 * own return value can no longer carry the eventual decision.
 *
 * Mirrors the pattern Papyrus's own Discussion feature uses for the identical problem (a human's
 * answer to something posed asynchronously): there, before_agent_start re-fetches and re-injects
 * blocking Discussion state into the system prompt every turn. An approval outcome is a one-shot
 * event rather than standing context, so this delivers it once, as a background pi.sendMessage()
 * follow-up (via agent-poll-ticker.ts's own AgentNotifier/frameAsBackgroundNotification), instead
 * of re-injecting it into the prompt every turn the way an unresolved Discussion is.
 */
import type { VehicleClient } from "@danypops/vehicle-core";
import { VEHICLE_APPROVAL_STATUS_OPERATION_NAME } from "@danypops/vehicle-core";
import { type AgentNotifier, frameAsBackgroundNotification } from "./agent-poll-ticker.js";

/** Bounds how many still-unresolved requestIds this tracker carries at once -- the oldest is
 * dropped (never surfaced) to make room, the same bounded-resource discipline as every other
 * Vehicle capacity limit. A caller that fires far more gated calls than it ever polls back on
 * must not grow this without bound. */
export const MAX_TRACKED_APPROVAL_REQUESTS = 100;

interface TrackedApprovalRequest {
	readonly requestId: string;
	readonly operationName: string;
	readonly recordedAt: number;
}

interface ApprovalStatusOutcome {
	readonly decision: "granted" | "denied";
	readonly decidedAt: number;
	readonly decidedBy?: string;
	readonly comment?: string;
}

interface ApprovalStatusResult {
	readonly requestId: string;
	readonly status: "pending" | "resolved" | "unknown";
	readonly outcome?: ApprovalStatusOutcome;
}

function isApprovalStatusResult(value: unknown): value is ApprovalStatusResult {
	if (typeof value !== "object" || value === null) return false;
	const status = (value as { status?: unknown }).status;
	return status === "pending" || status === "resolved" || status === "unknown";
}

/**
 * Tracks this process's own not-yet-surfaced gated-call requestIds and polls
 * vehicle.approval.status for each. Wire record() to RegisterVehicleToolsOptions.onApprovalPending
 * so every requestId that could otherwise go unrecoverable is captured the moment it's known; call
 * poll() periodically (a BoundedPoll, session_start, before_agent_start -- whatever cadence
 * already fits the consuming extension) to check for and deliver any outcome since observed.
 */
export class VehicleApprovalOutcomePoll {
	private readonly tracked = new Map<string, TrackedApprovalRequest>();

	constructor(
		private readonly client: Pick<VehicleClient, "invoke">,
		private readonly notifier: AgentNotifier,
	) {}

	/** Records a requestId to check back on later. Idempotent -- recording the same id twice keeps
	 * its original recordedAt rather than resetting it. */
	record(requestId: string, operationName: string, now: number = Date.now()): void {
		if (this.tracked.has(requestId)) return;
		if (this.tracked.size >= MAX_TRACKED_APPROVAL_REQUESTS) {
			const oldestId: string | undefined = this.tracked.keys().next().value; // Map preserves insertion order
			if (oldestId !== undefined) this.tracked.delete(oldestId);
		}
		this.tracked.set(requestId, { requestId, operationName, recordedAt: now });
	}

	/** How many requestIds are currently tracked, awaiting their first "resolved"/"unknown" poll result -- exposed for tests and diagnostics, not part of the delivery contract itself. */
	get trackedCount(): number {
		return this.tracked.size;
	}

	/**
	 * Checks every currently-tracked requestId and delivers a background notification for each one
	 * that's since resolved (or gone unknown -- expired without ever being decided) -- once each,
	 * then forgets it. A request still "pending" stays tracked for the next poll. Never throws: a
	 * single id's status-check or delivery failure must never block checking the rest, matching
	 * every other best-effort background poll in this package.
	 */
	async poll(): Promise<void> {
		for (const request of [...this.tracked.values()]) {
			let result: ApprovalStatusResult;
			try {
				const raw = await this.client.invoke(VEHICLE_APPROVAL_STATUS_OPERATION_NAME, 1, { requestId: request.requestId });
				if (!isApprovalStatusResult(raw)) continue;
				result = raw;
			} catch {
				continue; // transient -- leave it tracked, try again next poll
			}
			if (result.status === "pending") continue;
			this.tracked.delete(request.requestId);
			try {
				this.notifier.sendUserMessage(frameAsBackgroundNotification(this.buildMessage(request, result)), { deliverAs: "followUp" });
			} catch {
				// best-effort delivery, matching onApprovalPending's own contract
			}
		}
	}

	private buildMessage(request: TrackedApprovalRequest, result: ApprovalStatusResult): string {
		if (result.status === "unknown" || !result.outcome) {
			return `Approval request ${request.requestId} for ${request.operationName} expired without ever being decided (or its resolved-outcome history aged out) -- it will need to be retried.`;
		}
		const { decision, decidedBy, comment } = result.outcome;
		const by = decidedBy ? ` by ${decidedBy}` : "";
		const commentLine = comment ? `\nComment: ${comment}` : "";
		return `Approval request ${request.requestId} for ${request.operationName} was ${decision}${by}.${commentLine}`;
	}
}
