import type { VehicleManifestEvent } from "../events/event.js";
import type { VehicleEffect } from "../operations/effect.js";
import type { VehicleOperationDescriptor } from "../operations/operation.js";
import type { VehicleProtocolSupport } from "../protocol/negotiation.js";

export interface VehicleManifestIdentity {
	readonly name: string;
	readonly version: string;
	readonly description: string;
	readonly guidance?: readonly string[];
	/** Wire compatibility served independently from this package's version and each operation's version. */
	readonly protocol?: VehicleProtocolSupport;
}

/**
 * A manifest's own view of an operation: the static descriptor plus
 * whether it's currently usable on this particular server instance right
 * now. Availability is a runtime property of a live registry (a
 * credential got configured or removed), never baked into the static
 * descriptor defineVehicleOperation() produces -- two manifest() calls
 * against the same registry can report different availability for the
 * exact same descriptor.
 */
export interface VehicleManifestOperation extends VehicleOperationDescriptor {
	readonly available: boolean;
	readonly unavailableReason?: string;
	/**
	 * The registry's own, live, fully-resolved answer to "does invoking this operation right
	 * now require approval" -- accounts for the registry's current approval policy being
	 * enabled/disabled, this operation's own `requiresApproval` override when set, and the
	 * effect-derived default otherwise. A real VehicleRegistry.manifest() always sets this;
	 * before configureApprovals(), risky operations report true and fail closed while the
	 * manifest's approvalPolicy diagnostic identifies the missing explicit decision. Unlike
	 * `requiresApproval` (the static, author-declared override on the descriptor itself),
	 * this always reflects the current instant, so a client re-fetching the manifest after a
	 * live policy change (VehicleRegistry.updateApprovalPolicy) sees the new answer with no
	 * separate sync mechanism needed.
	 *
	 * Optional purely for backward compatibility with every hand-authored VehicleManifest
	 * test fixture across the ecosystem that predates this field (the same reason
	 * VehicleManifest.events is optional) -- a consumer reading it should treat undefined the
	 * same as a caller of classifyVehicleOperationSafety does: fall back to the effect-level
	 * default, never assume false.
	 */
	readonly approvalRequired?: boolean;
}

/** Reports whether a registry made an explicit approval-policy decision and names risky operations that still need one. */
export interface VehicleManifestApprovalPolicy {
	readonly status: "unconfigured" | "enabled" | "disabled";
	readonly requireApprovalForEffects: readonly VehicleEffect[];
	readonly unconfiguredRiskyOperations: readonly string[];
}

/**
 * `events` and `approvalPolicy` are optional for backward compatibility with
 * hand-authored and older manifests. A current VehicleRegistry always emits
 * both fields.
 */
export interface VehicleManifest extends VehicleManifestIdentity {
	readonly operations: readonly VehicleManifestOperation[];
	readonly events?: readonly VehicleManifestEvent[];
	readonly approvalPolicy?: VehicleManifestApprovalPolicy;
}
