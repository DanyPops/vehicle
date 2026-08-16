/**
 * Vehicle approval-gating workflow -- configureApprovals/updateApprovalPolicy, the built-in
 * vehicle.approval.resolve operation, pending-request bookkeeping, and the enforcement gate
 * invoke()/resolveForBackground() consult. Split out of VehicleRegistry's own bundled
 * responsibilities (Vehicle Pass 1 SRP audit finding #4).
 *
 * Depends on two narrow callbacks (register/emit/registerEvent) rather than the whole
 * VehicleRegistry, since this workflow's only real coupling to the rest of the registry is
 * registering its own resolve operation and emitting/declaring its own two built-in events --
 * everything else (pending-approval state, the policy itself) is this collaborator's own.
 */

import { randomUUID } from "node:crypto";
import type {
	VehicleApprovalAuthority,
	VehicleApprovalRequest,
	VehicleEffect,
	VehicleEvent,
	VehicleOperationBinding,
	VehicleOperationDescriptor,
	VehiclePrincipal,
} from "@danypops/vehicle-core";
import {
	bindVehicleOperation,
	DEFAULT_APPROVAL_EFFECTS,
	DEFAULT_APPROVAL_TIMEOUT_MS,
	defineVehicleOperation,
	defineVehicleSchema,
	VEHICLE_APPROVAL_RESOLVE_OPERATION_NAME,
	VehicleError,
	vehicleApprovalRequestedEvent,
	vehicleApprovalResolvedEvent,
} from "@danypops/vehicle-core";
import { HmacApprovalAuthority, hashApprovalInput } from "../vehicle-approval-authority.js";

/** Bounds how many gated invoke()s can be simultaneously awaiting a human/authority decision -- the same bounded-resource discipline as every other Vehicle capacity limit. */
const MAX_PENDING_APPROVALS = 256;

interface ApprovalPolicy {
	readonly requireApprovalForEffects: ReadonlySet<VehicleEffect>;
	readonly authority: VehicleApprovalAuthority;
	readonly timeoutMs: number;
	/** See {@link VehicleApprovalPolicyOptions.enabled}. */
	readonly enabled: boolean;
}

export interface VehicleApprovalPolicyOptions {
	/** Defaults to DEFAULT_APPROVAL_EFFECTS ([destructive, open-world]) -- the same set vehicle-client-pi historically hardcoded client-side. */
	readonly requireApprovalForEffects?: readonly VehicleEffect[];
	/** Defaults to a fresh HmacApprovalAuthority with a random per-instance secret. */
	readonly authority?: VehicleApprovalAuthority;
	/** How long a request stays resolvable before it lapses and must be re-requested. Defaults to DEFAULT_APPROVAL_TIMEOUT_MS. */
	readonly timeoutMs?: number;
	/**
	 * Whether the gate is actually active right now. Defaults to true (today's exact
	 * behavior: configuring approvals means gating is on). Set false to register the
	 * approval machinery (events, vehicle.approval.resolve) without enabling it yet, then
	 * flip it live later with updateApprovalPolicy({ enabled }) -- e.g. a consumer whose own
	 * approval preference is itself a live, user-toggleable setting (not a fixed
	 * per-deployment constant decided at process-start time) can mirror that setting here
	 * without recreating the registry.
	 */
	readonly enabled?: boolean;
}

/** Patch accepted by {@link VehicleApprovalPolicyManager.update} -- every field optional, only what's provided changes. */
export interface VehicleApprovalPolicyUpdate {
	readonly requireApprovalForEffects?: readonly VehicleEffect[];
	readonly enabled?: boolean;
}

interface ApprovalResolveInput {
	readonly requestId: string;
	readonly decision: "granted" | "denied";
	readonly decidedBy?: string;
	readonly comment?: string;
}

interface ApprovalResolveOutput {
	readonly requestId: string;
	readonly decision: "granted" | "denied";
	readonly capability?: string;
}

/** The narrow slice of VehicleRegistry this workflow needs -- registering its own resolve
 * operation, and declaring/emitting its own two built-in approval events. */
export interface ApprovalPolicyCollaborators {
	register<Input, Output>(owner: string, binding: VehicleOperationBinding<Input, Output>): void;
	registerEvent<Payload>(owner: string, event: VehicleEvent<Payload>): void;
	emit(name: string, version: number, payload: unknown): void;
}

export class VehicleApprovalPolicyManager {
	private policy?: ApprovalPolicy;
	private readonly pendingApprovals = new Map<string, VehicleApprovalRequest>();

	constructor(private readonly collaborators: ApprovalPolicyCollaborators) {}

	/**
	 * Opt-in only -- never called automatically, so a Vehicle that never
	 * configures approvals keeps today's exact manifest shape and invoke()
	 * behavior (no gating at all). Registers the two built-in approval
	 * events and the vehicle.approval.resolve operation at call time (not
	 * construction), so they only ever appear in a manifest for a Vehicle
	 * that actually uses them.
	 */
	configure(options: VehicleApprovalPolicyOptions = {}): void {
		if (this.policy) throw new Error("Vehicle approval policy is already configured");
		this.policy = {
			requireApprovalForEffects: new Set(options.requireApprovalForEffects ?? DEFAULT_APPROVAL_EFFECTS),
			authority: options.authority ?? new HmacApprovalAuthority(),
			timeoutMs: options.timeoutMs ?? DEFAULT_APPROVAL_TIMEOUT_MS,
			enabled: options.enabled ?? true,
		};
		this.collaborators.registerEvent("vehicle-registry", vehicleApprovalRequestedEvent);
		this.collaborators.registerEvent("vehicle-registry", vehicleApprovalResolvedEvent);
		this.registerApprovalResolveOperation();
	}

	/**
	 * Live update to an already-configured approval policy -- unlike configure()
	 * itself (a one-shot: it also registers events/the resolve operation, which can't be
	 * registered twice), this only ever touches the mutable policy fields and can be called
	 * any number of times. An already-pending approval request (recorded under whatever
	 * policy existed when enforceGate() first saw it) is unaffected -- it resolves
	 * or expires under the policy in effect at that time, the same way it already would if
	 * nothing here ever changed.
	 */
	update(patch: VehicleApprovalPolicyUpdate): void {
		if (!this.policy) throw new Error("Vehicle approval policy is not configured -- call configureApprovals() first");
		this.policy = {
			...this.policy,
			...(patch.requireApprovalForEffects ? { requireApprovalForEffects: new Set(patch.requireApprovalForEffects) } : {}),
			...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
		};
	}

	private registerApprovalResolveOperation(): void {
		const inputSchema = defineVehicleSchema<ApprovalResolveInput>({
			jsonSchema: {
				type: "object",
				properties: {
					requestId: { type: "string" },
					decision: { type: "string", enum: ["granted", "denied"] },
					decidedBy: { type: "string" },
					comment: { type: "string", maxLength: 2_000 },
				},
				required: ["requestId", "decision"],
				additionalProperties: false,
			},
			safeParse(value) {
				if (typeof value !== "object" || value === null) {
					return { success: false, issues: [{ path: [], message: "input must be an object" }] };
				}
				const row = value as Record<string, unknown>;
				if (typeof row.requestId !== "string" || !row.requestId.trim()) {
					return { success: false, issues: [{ path: ["requestId"], message: "requestId must be a non-empty string" }] };
				}
				if (row.decision !== "granted" && row.decision !== "denied") {
					return { success: false, issues: [{ path: ["decision"], message: "decision must be granted or denied" }] };
				}
				if (row.decidedBy !== undefined && typeof row.decidedBy !== "string") {
					return { success: false, issues: [{ path: ["decidedBy"], message: "decidedBy must be a string" }] };
				}
				if (row.comment !== undefined && (typeof row.comment !== "string" || row.comment.length > 2_000)) {
					return { success: false, issues: [{ path: ["comment"], message: "comment must be a string of at most 2000 characters" }] };
				}
				return {
					success: true,
					value: {
						requestId: row.requestId,
						decision: row.decision,
						...(row.decidedBy !== undefined ? { decidedBy: row.decidedBy } : {}),
						...(row.comment !== undefined ? { comment: row.comment } : {}),
					},
				};
			},
		});
		const outputSchema = defineVehicleSchema<ApprovalResolveOutput>({
			jsonSchema: {
				type: "object",
				properties: { requestId: { type: "string" }, decision: { type: "string" }, capability: { type: "string" } },
				required: ["requestId", "decision"],
				additionalProperties: false,
			},
			safeParse(value) {
				const row = value as { requestId?: unknown; decision?: unknown; capability?: unknown };
				if (typeof row?.requestId !== "string" || typeof row.decision !== "string") {
					return { success: false, issues: [{ path: [], message: "invalid approval resolve output" }] };
				}
				return {
					success: true,
					value: {
						requestId: row.requestId,
						decision: row.decision as "granted" | "denied",
						...(typeof row.capability === "string" ? { capability: row.capability } : {}),
					},
				};
			},
		});

		const ResolveOperation = defineVehicleOperation({
			name: VEHICLE_APPROVAL_RESOLVE_OPERATION_NAME,
			version: 1,
			description: "Grants or denies a pending Vehicle approval request, minting a real capability on grant.",
			input: inputSchema,
			output: outputSchema,
			permissions: ["vehicle:approvals:resolve"],
			effect: "local-write",
			idempotency: { mode: "unsafe" },
			limits: { defaultTimeoutMs: 5_000, maxTimeoutMs: 5_000, maxRequestBytes: 4_096, maxResponseBytes: 4_096 },
		});

		this.collaborators.register(
			"vehicle-registry",
			bindVehicleOperation(ResolveOperation, () => async (context) => this.resolveApprovalRequest(context.input)),
		);
	}

	private resolveApprovalRequest(input: ApprovalResolveInput): ApprovalResolveOutput {
		this.prunePendingApprovals();
		const request = this.pendingApprovals.get(input.requestId);
		if (!request) {
			throw new VehicleError("not-found", `No pending Vehicle approval request ${input.requestId}`, { category: "not_found" });
		}
		this.pendingApprovals.delete(input.requestId);

		const capability = input.decision === "granted" ? this.policy?.authority.mint(request) : undefined;
		this.collaborators.emit(vehicleApprovalResolvedEvent.descriptor.name, vehicleApprovalResolvedEvent.descriptor.version, {
			requestId: input.requestId,
			decision: input.decision,
			decidedAt: Date.now(),
			...(input.decidedBy ? { decidedBy: input.decidedBy } : {}),
			...(input.comment ? { comment: input.comment } : {}),
		});
		return { requestId: input.requestId, decision: input.decision, ...(capability ? { capability } : {}) };
	}

	private prunePendingApprovals(): void {
		const now = Date.now();
		for (const [requestId, request] of this.pendingApprovals) {
			if (request.expiresAt <= now) this.pendingApprovals.delete(requestId);
		}
	}

	/**
	 * The single source of truth for "does invoking this operation right now require
	 * approval" -- consulted by both enforceGate() (to decide whether to actually
	 * gate) and VehicleRegistry.manifest() (to report the live answer as VehicleManifestOperation's
	 * own approvalRequired field, so a client re-fetching the manifest sees a policy change
	 * with no separate sync mechanism needed). False whenever the registry's approval
	 * policy was never configured, or was configured but is currently disabled
	 * (VehicleApprovalPolicyOptions.enabled / update()). Otherwise: the
	 * operation's own requiresApproval override when it set one, else the effect-derived
	 * default against the policy's requireApprovalForEffects set.
	 */
	resolvesToApprovalRequired(descriptor: VehicleOperationDescriptor): boolean {
		const policy = this.policy;
		if (!policy?.enabled) return false;
		return descriptor.requiresApproval ?? policy.requireApprovalForEffects.has(descriptor.effect);
	}

	/**
	 * No-op unless resolvesToApprovalRequired() says this operation is currently gated. A
	 * presented capability is verified for real (operation+input+expiry+single-use) rather
	 * than merely checked for non-emptiness; an absent one records a durable, retryable
	 * approval.requested event before failing, so the caller always has a path forward (see
	 * vehicle.approval.resolve) instead of a dead end.
	 */
	enforceGate(
		key: string,
		descriptor: VehicleOperationDescriptor,
		principal: VehiclePrincipal | undefined,
		input: unknown,
		operationId: string,
		presentedCapability: string | undefined,
	): void {
		if (!this.resolvesToApprovalRequired(descriptor)) return;
		const policy = this.policy as ApprovalPolicy;
		const { name, version, effect } = descriptor;
		const inputHash = hashApprovalInput(input);

		if (presentedCapability) {
			if (policy.authority.verify(presentedCapability, name, version, inputHash)) return;
			throw new VehicleError("approval-capability-invalid", `${key} rejected the presented approval capability`, {
				category: "authorization",
				operationId,
				retryable: false,
			});
		}

		this.prunePendingApprovals();
		if (this.pendingApprovals.size >= MAX_PENDING_APPROVALS) {
			throw new VehicleError("capacity-exceeded", "Too many pending Vehicle approval requests", { category: "capacity", operationId });
		}
		const requestId = randomUUID();
		const requestedAt = Date.now();
		const expiresAt = requestedAt + policy.timeoutMs;
		const request: VehicleApprovalRequest = {
			requestId,
			operationName: name,
			operationVersion: version,
			effect,
			principal,
			requestedAt,
			expiresAt,
			inputHash,
		};
		this.pendingApprovals.set(requestId, request);
		this.collaborators.emit(vehicleApprovalRequestedEvent.descriptor.name, vehicleApprovalRequestedEvent.descriptor.version, request);
		throw new VehicleError("approval-required", `${key} requires approval before it can run`, {
			category: "authorization",
			operationId,
			retryable: true,
			details: { requestId, expiresAt },
		});
	}
}
