import type { VehicleManifestEvent } from "../events/event.js";
import type { VehicleOperationDescriptor } from "../operations/operation.js";

export interface VehicleManifestIdentity {
	readonly name: string;
	readonly version: string;
	readonly description: string;
	readonly guidance?: readonly string[];
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
	 * effect-derived default otherwise. A real VehicleRegistry.manifest() always sets this
	 * (false when the registry never called configureApprovals() at all) -- unlike
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

/**
 * `events` is optional purely for backward compatibility with every
 * hand-authored VehicleManifest test fixture across the ecosystem that
 * predates this field -- a real VehicleRegistry.manifest() always
 * populates it (as [] when no events are declared), never omits it.
 */
export interface VehicleManifest extends VehicleManifestIdentity {
	readonly operations: readonly VehicleManifestOperation[];
	readonly events?: readonly VehicleManifestEvent[];
}
