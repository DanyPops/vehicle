/**
 * Wire-level shapes for the Approval Gate: a pending human/authority decision
 * that stands between a gated-effect invoke() and its handler actually
 * running. Kept in vehicle-core (runtime-neutral, zero dependencies) --
 * the actual signing/verification authority (HmacApprovalAuthority) needs
 * node:crypto and lives in vehicle-server instead, the same split
 * atomic-json.ts already uses for fs access.
 */
import { defineVehicleEvent } from "../events/event.js";
import type { VehiclePrincipal } from "../operations/context.js";
import type { VehicleEffect } from "../operations/effect.js";
import { VEHICLE_EFFECTS } from "../operations/effect.js";
import { defineVehicleSchema } from "../schemas/codec.js";

/** A sha256 hex digest: exactly 64 lowercase hex characters -- matches hashApprovalInput's own (vehicle-server) output shape. */
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

function isVehicleEffect(value: unknown): value is VehicleEffect {
	return typeof value === "string" && (VEHICLE_EFFECTS as readonly string[]).includes(value);
}

function isVehiclePrincipal(value: unknown): value is VehiclePrincipal {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value as Record<string, unknown>;
	if (typeof candidate["id"] !== "string") return false;
	if (candidate["claims"] === undefined) return true;
	return typeof candidate["claims"] === "object" && candidate["claims"] !== null && !Array.isArray(candidate["claims"]);
}

/** Set once at registry-configuration time (VehicleRegistry.configureApprovals()); never on a per-invoke basis. */
export const DEFAULT_APPROVAL_EFFECTS: readonly VehicleEffect[] = ["destructive", "open-world"];

/**
 * The name VehicleRegistry.configureApprovals() registers its built-in
 * grant/deny operation under. Shared so vehicle-client-pi can recognize and
 * exclude it from Pi tool projection by exact name (see its own use site):
 * it is invoked only via this package's own approval-required retry dance
 * using the extension's already-fixed permissions, never meant to be a
 * model-callable tool -- a model that could call it directly would be able
 * to grant its own pending approval requests, defeating the human-in-the-
 * loop point of the gate entirely.
 */
export const VEHICLE_APPROVAL_RESOLVE_OPERATION_NAME = "vehicle.approval.resolve";

/**
 * The name VehicleRegistry.configureApprovals() registers its own read-only status-lookup
 * operation under. Unlike vehicle.approval.resolve, this one is deliberately left projectable
 * as an ordinary Pi/model-callable tool: reading a requestId's own already-made decision (who
 * decided, when, and any comment) can never let a caller grant its own pending request -- it
 * only ever surfaces a decision a human (or other authority) already recorded. Exists because a
 * gated invoke()'s own local HITL prompt and the eventual human decision can genuinely happen on
 * two different calls (a caller-side timeout, a UI presented asynchronously outside the
 * originating call's own lifetime, a session restart in between) -- without this, a decision
 * (and any comment explaining it) made after the originating call already gave up is
 * unrecoverable, since vehicle.approval.resolve's own vehicleApprovalResolvedEvent is transient
 * pub/sub with no replay for a caller that wasn't subscribed at that exact moment.
 */
export const VEHICLE_APPROVAL_STATUS_OPERATION_NAME = "vehicle.approval.status";

/** How long a request stays resolvable before it lapses and must be re-requested. */
export const DEFAULT_APPROVAL_TIMEOUT_MS = 5 * 60_000;

/** Emitted (as a Vehicle Event) the moment a gated-effect invoke() has no valid capability -- durable-first, before any interactive prompt is attempted. */
export interface VehicleApprovalRequest {
	readonly requestId: string;
	readonly operationName: string;
	readonly operationVersion: number;
	readonly effect: VehicleEffect;
	readonly principal?: VehiclePrincipal;
	readonly requestedAt: number;
	readonly expiresAt: number;
	/** sha256 hex of the exact input the gated invoke() attempted -- a minted capability is scoped to this input, not just the operation. */
	readonly inputHash: string;
}

export type VehicleApprovalDecision = "granted" | "denied";

/** Emitted once vehicle.approval.resolve settles a request, whichever way. */
export interface VehicleApprovalOutcome {
	readonly requestId: string;
	readonly decision: VehicleApprovalDecision;
	readonly decidedAt: number;
	readonly decidedBy?: string;
	/** Optional human rationale captured by a rich HITL presenter. */
	readonly comment?: string;
}

/**
 * The real authority behind an approvalCapability -- replaces today's
 * "any non-empty string satisfies it" rubber stamp. mint() is called only
 * from inside vehicle.approval.resolve once a decision is actually made;
 * verify() is called from invoke() itself against whatever capability the
 * caller presents. A capability is scoped to the exact operation+input it
 * was minted for and expires with its originating request -- presenting a
 * capability minted for a different operation, a different input, or one
 * already consumed (single-use) must fail verify().
 */
export interface VehicleApprovalAuthority {
	mint(request: Pick<VehicleApprovalRequest, "requestId" | "operationName" | "operationVersion" | "expiresAt" | "inputHash">): string;
	verify(capability: string, operationName: string, operationVersion: number, inputHash: string): boolean;
}

const requestedPayloadSchema = defineVehicleSchema<VehicleApprovalRequest>({
	jsonSchema: {
		type: "object",
		properties: {
			requestId: { type: "string" },
			operationName: { type: "string" },
			operationVersion: { type: "number" },
			effect: { type: "string", enum: [...VEHICLE_EFFECTS] },
			principal: { type: "object" },
			requestedAt: { type: "number" },
			expiresAt: { type: "number" },
			inputHash: { type: "string" },
		},
		required: ["requestId", "operationName", "operationVersion", "effect", "requestedAt", "expiresAt", "inputHash"],
		additionalProperties: true,
	},
	safeParse(value) {
		if (typeof value !== "object" || value === null) return { success: false, issues: [{ path: [], message: "input must be an object" }] };
		const row = value as Record<string, unknown>;
		if (
			typeof row["requestId"] !== "string" ||
			typeof row["operationName"] !== "string" ||
			typeof row["operationVersion"] !== "number" ||
			!Number.isInteger(row["operationVersion"]) ||
			row["operationVersion"] < 1 ||
			!isVehicleEffect(row["effect"]) ||
			typeof row["requestedAt"] !== "number" ||
			!Number.isFinite(row["requestedAt"]) ||
			typeof row["expiresAt"] !== "number" ||
			!Number.isFinite(row["expiresAt"]) ||
			typeof row["inputHash"] !== "string" ||
			!SHA256_HEX_PATTERN.test(row["inputHash"])
		) {
			return { success: false, issues: [{ path: [], message: "invalid approval request payload" }] };
		}
		if (row["principal"] !== undefined && !isVehiclePrincipal(row["principal"])) {
			return { success: false, issues: [{ path: ["principal"], message: "invalid approval request principal" }] };
		}
		return { success: true, value: row as unknown as VehicleApprovalRequest };
	},
});

const resolvedPayloadSchema = defineVehicleSchema<VehicleApprovalOutcome>({
	jsonSchema: {
		type: "object",
		properties: {
			requestId: { type: "string" },
			decision: { type: "string", enum: ["granted", "denied"] },
			decidedAt: { type: "number" },
			decidedBy: { type: "string" },
			comment: { type: "string" },
		},
		required: ["requestId", "decision", "decidedAt"],
		additionalProperties: true,
	},
	safeParse(value) {
		if (typeof value !== "object" || value === null) return { success: false, issues: [{ path: [], message: "input must be an object" }] };
		const row = value as Record<string, unknown>;
		if (
			typeof row["requestId"] !== "string" ||
			(row["decision"] !== "granted" && row["decision"] !== "denied") ||
			typeof row["decidedAt"] !== "number" ||
			!Number.isFinite(row["decidedAt"])
		) {
			return { success: false, issues: [{ path: [], message: "invalid approval outcome payload" }] };
		}
		if (row["decidedBy"] !== undefined && typeof row["decidedBy"] !== "string") {
			return { success: false, issues: [{ path: ["decidedBy"], message: "decidedBy must be a string" }] };
		}
		if (row["comment"] !== undefined && typeof row["comment"] !== "string") {
			return { success: false, issues: [{ path: ["comment"], message: "comment must be a string" }] };
		}
		return { success: true, value: row as unknown as VehicleApprovalOutcome };
	},
});

/** Built into every VehicleRegistry once configureApprovals() is called -- never registered unconditionally, so a Vehicle that never opts in has zero manifest/shape change. */
export const vehicleApprovalRequestedEvent = defineVehicleEvent<VehicleApprovalRequest>({
	name: "vehicle.approval.requested",
	version: 1,
	description: "A gated-effect operation was invoked without a valid approval capability.",
	payload: requestedPayloadSchema,
	maxPayloadBytes: 16_384,
});

export const vehicleApprovalResolvedEvent = defineVehicleEvent<VehicleApprovalOutcome>({
	name: "vehicle.approval.resolved",
	version: 1,
	description: "A pending approval request was granted or denied.",
	payload: resolvedPayloadSchema,
	maxPayloadBytes: 4_096,
});
