import type { VehicleJobWakeBudget } from "../jobs/wake-log.js";
import { cloneJson, type JsonSchema } from "../schemas/json.js";
import type { VehicleSchemaCodec } from "../schemas/codec.js";
import type { VehicleOperationHandler } from "./context.js";
import type { VehicleEffect } from "./effect.js";

export type VehicleIdempotency =
	| { readonly mode: "safe" }
	| { readonly mode: "keyed"; readonly retentionMs: number }
	| { readonly mode: "unsafe" };

export interface VehicleLimits {
	readonly defaultTimeoutMs: number;
	readonly maxTimeoutMs: number;
	readonly maxRequestBytes: number;
	readonly maxResponseBytes: number;
}

/** One structured, documented failure mode a {@link VehicleOperationDescriptor} declares up front -- part of the operation's own serializable contract, not an ad hoc thrown Error a caller has to reverse-engineer from a message string. */
export interface VehicleFailureDescriptor {
	readonly code: string;
	readonly description: string;
}

/** Declares an operation safe to run as a Vehicle Job (detached, polled/tailed/canceled by id). Absent means live-invoke only. */
export interface VehicleBackgroundCapability {
	readonly supported: true;
	readonly defaultWakeBudget: VehicleJobWakeBudget;
	readonly maxWakeBudget: VehicleJobWakeBudget;
}

/**
 * The serializable half of a Vehicle operation -- name, version, schemas,
 * ownership-implying permissions, effect classification, idempotency,
 * streaming/long-running capability, request/response limits, and declared
 * {@link VehicleFailureDescriptor} failure modes. Kept separate from the
 * executable {@link VehicleOperationHandler} on purpose: a manifest, a Pi
 * tool projection, or a client's own capability check can all inspect this
 * shape without ever touching (or needing to trust) the implementation
 * behind it.
 */
export interface VehicleOperationDescriptor {
	readonly name: string;
	readonly version: number;
	readonly description: string;
	readonly inputSchema: JsonSchema;
	readonly outputSchema: JsonSchema;
	readonly permissions: readonly string[];
	readonly effect: VehicleEffect;
	readonly idempotency: VehicleIdempotency;
	readonly streaming: boolean;
	readonly longRunning: boolean;
	readonly limits: VehicleLimits;
	readonly errors: readonly VehicleFailureDescriptor[];
	readonly background?: VehicleBackgroundCapability;
	/**
	 * Owner-declared override for whether this specific operation is ever a candidate for
	 * approval gating, independent of its `effect`. Undefined (the default) means "derive it
	 * from `effect` against the registry's own requireApprovalForEffects set instead" --
	 * VehicleRegistry.manifest()'s own resolution rule, unchanged for every existing
	 * operation that never sets this.
	 *
	 * Exists because VehicleEffect's five values are coarse enough that two operations a
	 * real owner classifies very differently (e.g. "restart an already-installed,
	 * already-vetted service" vs. "sync a read-only catalog mirror") can land in the same
	 * effect bucket (both external-write) -- no single requireApprovalForEffects set can
	 * gate one without also gating the other. The owner who registers the operation knows
	 * its real risk far better than a 5-value enum can; this lets them say so directly.
	 */
	readonly requiresApproval?: boolean;
}

export interface VehicleOperation<Input, Output> {
	readonly descriptor: VehicleOperationDescriptor;
	readonly input: VehicleSchemaCodec<Input>;
	readonly output: VehicleSchemaCodec<Output>;
}

export interface DefineVehicleOperationOptions<Input, Output> {
	readonly name: string;
	readonly version: number;
	readonly description: string;
	readonly input: VehicleSchemaCodec<Input>;
	readonly output: VehicleSchemaCodec<Output>;
	readonly permissions?: readonly string[];
	readonly effect: VehicleEffect;
	readonly idempotency: VehicleIdempotency;
	readonly streaming?: boolean;
	readonly longRunning?: boolean;
	readonly limits: VehicleLimits;
	readonly errors?: readonly VehicleFailureDescriptor[];
	readonly background?: VehicleBackgroundCapability;
	/** See {@link VehicleOperationDescriptor.requiresApproval}. */
	readonly requiresApproval?: boolean;
}

export interface VehicleOperationBinding<Input, Output> {
	readonly operation: VehicleOperation<Input, Output>;
	bind(): VehicleOperationHandler<Input, Output>;
}

export function defineVehicleOperation<Input, Output>(
	options: DefineVehicleOperationOptions<Input, Output>,
): VehicleOperation<Input, Output> {
	validateOperationMetadata(options);
	const descriptor: VehicleOperationDescriptor = Object.freeze({
		name: options.name,
		version: options.version,
		description: options.description,
		inputSchema: cloneJson(options.input.jsonSchema),
		outputSchema: cloneJson(options.output.jsonSchema),
		permissions: Object.freeze([...(options.permissions ?? [])]),
		effect: options.effect,
		idempotency: Object.freeze({ ...options.idempotency }),
		streaming: options.streaming ?? false,
		longRunning: options.longRunning ?? false,
		limits: Object.freeze({ ...options.limits }),
		errors: Object.freeze((options.errors ?? []).map((failure) => Object.freeze({ ...failure }))),
		...(options.requiresApproval !== undefined ? { requiresApproval: options.requiresApproval } : {}),
		...(options.background
			? {
					background: Object.freeze({
						supported: true as const,
						defaultWakeBudget: Object.freeze({ ...options.background.defaultWakeBudget }),
						maxWakeBudget: Object.freeze({ ...options.background.maxWakeBudget }),
					}),
				}
			: {}),
	});
	return Object.freeze({ descriptor, input: options.input, output: options.output });
}

export function bindVehicleOperation<Input, Output>(
	operation: VehicleOperation<Input, Output>,
	bind: () => VehicleOperationHandler<Input, Output>,
): VehicleOperationBinding<Input, Output> {
	return Object.freeze({ operation, bind });
}

function validateOperationMetadata<Input, Output>(options: DefineVehicleOperationOptions<Input, Output>): void {
	if (!options.name.trim()) throw new Error("Vehicle operation name must not be empty");
	if (!Number.isInteger(options.version) || options.version < 1) {
		throw new Error("Vehicle operation version must be a positive integer");
	}
	if (!options.description.trim()) throw new Error("Vehicle operation description must not be empty");
	for (const permission of options.permissions ?? []) {
		if (!permission.trim()) throw new Error("Vehicle operation permissions must not contain an empty value");
	}
	const limits = options.limits;
	for (const [name, value] of Object.entries(limits)) {
		if (!Number.isSafeInteger(value) || value < 1) throw new Error(`Vehicle operation ${name} must be a positive integer`);
	}
	if (limits.defaultTimeoutMs > limits.maxTimeoutMs) {
		throw new Error("Vehicle operation defaultTimeoutMs must not exceed maxTimeoutMs");
	}
	if (
		options.idempotency.mode === "keyed" &&
		(!Number.isSafeInteger(options.idempotency.retentionMs) || options.idempotency.retentionMs < 1)
	) {
		throw new Error("Vehicle keyed idempotency retentionMs must be a positive integer");
	}
	if (options.background) {
		if (!options.longRunning) {
			throw new Error("Vehicle operation with a background capability must also set longRunning: true");
		}
		for (const [budgetName, budget] of [
			["defaultWakeBudget", options.background.defaultWakeBudget],
			["maxWakeBudget", options.background.maxWakeBudget],
		] as const) {
			if (!Number.isSafeInteger(budget.maxCount) || budget.maxCount < 1) {
				throw new Error(`Vehicle operation background.${budgetName}.maxCount must be a positive integer`);
			}
			if (!Number.isSafeInteger(budget.maxBytes) || budget.maxBytes < 1) {
				throw new Error(`Vehicle operation background.${budgetName}.maxBytes must be a positive integer`);
			}
		}
		if (options.background.defaultWakeBudget.maxCount > options.background.maxWakeBudget.maxCount) {
			throw new Error("Vehicle operation background.defaultWakeBudget.maxCount must not exceed maxWakeBudget.maxCount");
		}
		if (options.background.defaultWakeBudget.maxBytes > options.background.maxWakeBudget.maxBytes) {
			throw new Error("Vehicle operation background.defaultWakeBudget.maxBytes must not exceed maxWakeBudget.maxBytes");
		}
	}
}
