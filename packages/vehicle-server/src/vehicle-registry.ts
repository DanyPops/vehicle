import { randomUUID } from "node:crypto";
import type {
	VehicleBackgroundCapability,
	VehicleEvent,
	VehicleInvocationOptions,
	VehicleManifest,
	VehicleManifestIdentity,
	VehicleOperationBinding,
	VehicleOperationContext,
	VehicleOperationDescriptor,
	VehiclePrincipal,
	VehicleSchemaCodec,
	VehicleSchemaResult,
} from "@danypops/vehicle-core";
import { boundedCauseMessage, boundedValidationDetails, isVehicleError, VehicleError, vehicleEventTopic } from "@danypops/vehicle-core";
import { VehicleApprovalPolicyManager } from "./vehicle-registry/approval-policy.js";
import { VehicleEventPubSub } from "./vehicle-registry/event-pubsub.js";
import { readPackageVersion } from "./version.js";

export type {
	VehicleApprovalPolicyOptions,
	VehicleApprovalPolicyUpdate,
} from "./vehicle-registry/approval-policy.js";

/** Appends the cause's own message to `prefix` when `expose` is true, else returns `prefix` unchanged. */
function unexpectedFailureMessage(prefix: string, error: unknown, expose: boolean): string {
	if (!expose) return prefix;
	const cause = boundedCauseMessage(error);
	return cause === undefined ? prefix : `${prefix}: ${cause}`;
}

export interface VehicleExecutionRequest {
	readonly operation: VehicleOperationDescriptor;
	readonly input: unknown;
	readonly operationId: string;
	readonly correlationId?: string;
	readonly callerSessionId?: string;
	readonly callerProjectRoot?: string;
	readonly signal: AbortSignal;
	readonly deadline: number;
	readonly permissions: readonly string[];
	readonly principal?: VehiclePrincipal;
	readonly idempotencyKey?: string;
	readonly expectedRevision?: string | number;
	readonly approvalCapability?: string;
}

export interface VehicleExecutionPolicy {
	execute(request: VehicleExecutionRequest, invoke: (effectiveInput: unknown) => Promise<unknown>): Promise<unknown>;
}

interface InvocationContext {
	readonly operationId: string;
	readonly correlationId?: string;
	readonly callerSessionId?: string;
	readonly callerProjectRoot?: string;
	readonly signal: AbortSignal;
	readonly deadline: number;
	readonly permissions: readonly string[];
	readonly principal?: VehiclePrincipal;
	readonly idempotencyKey?: string;
	readonly expectedRevision?: string | number;
	readonly approvalCapability?: string;
	reportProgress(progress: unknown): void;
}

interface Registration {
	readonly owner: string;
	readonly descriptor: VehicleOperationDescriptor;
	parseInput(value: unknown, operationId: string): unknown;
	parseOutput(value: unknown, operationId: string): unknown;
	invoke(input: unknown, context: InvocationContext): Promise<unknown>;
}

/** A publish(topic, payload) sink -- PushChannel satisfies this structurally with zero import needed; see bridgeVehicleEventsToPushChannel below. */
export interface VehicleEventPublisher {
	publish(topic: string, payload: unknown): void;
}

function operationKey(name: string, version: number): string {
	return `${name}@${version}`;
}

function parseWithSchema<T>(
	schema: VehicleSchemaCodec<T>,
	value: unknown,
	kind: "input" | "output",
	descriptor: VehicleOperationDescriptor,
	operationId: string,
): T {
	let result: VehicleSchemaResult<T>;
	try {
		result = schema.safeParse(value);
	} catch (error) {
		throw new VehicleError(
			`invalid-${kind}`,
			`${operationKey(descriptor.name, descriptor.version)} returned an invalid ${kind} boundary result`,
			{
				category: kind === "input" ? "validation" : "internal",
				operationId,
				cause: error,
			},
		);
	}
	if (!result.success) {
		throw new VehicleError(`invalid-${kind}`, `${operationKey(descriptor.name, descriptor.version)} received invalid ${kind}`, {
			category: kind === "input" ? "validation" : "internal",
			operationId,
			details: boundedValidationDetails(result.issues),
		});
	}
	return result.value;
}

/** `key` + `timeoutMs` name which operation timed out and its actual configured budget --
 * a bare "Vehicle operation deadline exceeded" gives a caller nothing to act on (which
 * operation? was it close, or wildly exceeded?). timeoutMs is the budget granted at
 * invocation time, not recomputed here ("now" has already moved past `deadline`). */
function abortError(signal: AbortSignal, deadline: number, operationId: string, key: string, timeoutMs: number): VehicleError {
	const timedOut = Date.now() >= deadline || (signal.reason instanceof Error && signal.reason.name === "TimeoutError");
	return new VehicleError(
		timedOut ? "deadline-exceeded" : "cancelled",
		timedOut
			? `${key} exceeded its ${timeoutMs}ms deadline -- the operation was still running when the timeout elapsed`
			: "Vehicle operation cancelled",
		{
			category: timedOut ? "timeout" : "cancelled",
			retryable: false,
			operationId,
			cause: signal.reason,
		},
	);
}

async function awaitWithSignal<T>(
	operation: Promise<T>,
	signal: AbortSignal,
	deadline: number,
	operationId: string,
	key: string,
	timeoutMs: number,
): Promise<T> {
	if (signal.aborted) throw abortError(signal, deadline, operationId, key, timeoutMs);
	return new Promise<T>((resolve, reject) => {
		const onAbort = (): void => reject(abortError(signal, deadline, operationId, key, timeoutMs));
		signal.addEventListener("abort", onAbort, { once: true });
		void operation.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
	});
}

function effectiveDeadline(descriptor: VehicleOperationDescriptor, requested: number | undefined): number {
	const now = Date.now();
	const maximum = now + descriptor.limits.maxTimeoutMs;
	return requested === undefined ? now + descriptor.limits.defaultTimeoutMs : Math.min(requested, maximum);
}

function enforcePayloadSize(value: unknown, maxBytes: number, kind: "request" | "response", key: string, operationId: string): void {
	let serialized: string | undefined;
	try {
		serialized = JSON.stringify(value);
	} catch (error) {
		throw new VehicleError(kind === "request" ? "invalid-input" : "invalid-output", `${key} ${kind} is not JSON-serializable`, {
			category: kind === "request" ? "validation" : "internal",
			operationId,
			cause: error,
		});
	}
	if (serialized === undefined) {
		throw new VehicleError(kind === "request" ? "invalid-input" : "invalid-output", `${key} ${kind} is not JSON-serializable`, {
			category: kind === "request" ? "validation" : "internal",
			operationId,
		});
	}
	const actualBytes = new TextEncoder().encode(serialized).byteLength;
	if (actualBytes > maxBytes) {
		throw new VehicleError(
			kind === "request" ? "request-too-large" : "response-too-large",
			`${key} ${kind} exceeds its ${maxBytes}-byte limit`,
			{
				category: "capacity",
				operationId,
				details: { actualBytes, maxBytes },
			},
		);
	}
}

interface AvailabilityState {
	readonly available: boolean;
	readonly reason?: string;
}

export interface VehicleBackgroundResolutionOptions {
	readonly operationId?: string;
	readonly correlationId?: string;
	readonly callerSessionId?: string;
	readonly callerProjectRoot?: string;
	readonly permissions?: readonly string[];
	readonly principal?: VehiclePrincipal;
	readonly idempotencyKey?: string;
	readonly expectedRevision?: string | number;
	readonly approvalCapability?: string;
}

/** Everything VehicleJobStore needs to run a background op detached: validated descriptor/capability, parsed input, and a run() that validates the result like invoke() does. */
export interface VehicleBackgroundResolution {
	readonly descriptor: VehicleOperationDescriptor;
	readonly background: VehicleBackgroundCapability;
	readonly operationId: string;
	readonly parsedInput: unknown;
	run(context: VehicleOperationContext<unknown>): Promise<unknown>;
}

export interface VehiclePackageManifestIdentity extends Omit<VehicleManifestIdentity, "version"> {
	readonly packageJsonUrl: URL;
	readonly version?: never;
}

export type VehicleRegistryIdentity = (VehicleManifestIdentity & { readonly packageJsonUrl?: never }) | VehiclePackageManifestIdentity;

function resolveManifestIdentity(identity: VehicleRegistryIdentity): VehicleManifestIdentity {
	if (identity.packageJsonUrl !== undefined) {
		const { packageJsonUrl, ...manifestIdentity } = identity;
		return { ...manifestIdentity, version: readPackageVersion(packageJsonUrl, identity.name) };
	}
	return identity;
}

/**
 * The daemon-side execution engine at the root of `@danypops/vehicle-server`:
 * operation registration, permission/deadline/payload enforcement, an
 * injectable {@link VehicleExecutionPolicy} hook, and
 * `setAvailability(name, version, available, reason?)`, which toggles a
 * registered operation's usability at runtime (e.g. a credential got
 * configured or removed) -- there's no unregister; an operation's shape is
 * permanent once registered, only whether `manifest()` reports it available
 * and whether `invoke()` accepts it.
 *
 * Event pub/sub (see ./vehicle-registry/event-pubsub.ts) and the approval-gating workflow (see
 * ./vehicle-registry/approval-policy.ts) are injected collaborators rather than implemented
 * directly on this class -- both are genuinely separable responsibilities that only need a
 * narrow callback back into register()/emit(), not the whole registry.
 *
 * Kept separate from `./http`'s `createVehicleHttpApp()` (which exposes a
 * registry over `GET /vehicle/manifest`, `POST /vehicle/invoke`, and
 * `POST /vehicle/cancel`) on purpose: a consumer that only builds/tests a
 * registry never pulls in HTTP request/response plumbing.
 */
export class VehicleRegistry {
	private readonly registrations = new Map<string, Registration>();
	private readonly availability = new Map<string, AvailabilityState>();
	private readonly identity: VehicleManifestIdentity;
	private readonly eventPubSub = new VehicleEventPubSub();
	private approvalManager?: VehicleApprovalPolicyManager;
	/** Default false: an unexpected handler exception's message could contain a credential or internal detail. See setExposeHandlerFailureDetails(). */
	private exposeHandlerFailureDetails = false;

	constructor(
		identity: VehicleRegistryIdentity,
		private executionPolicy?: VehicleExecutionPolicy,
	) {
		if (!identity.name.trim()) throw new Error("Vehicle name must not be empty");
		if (!identity.description.trim()) throw new Error("Vehicle description must not be empty");
		const manifestIdentity = resolveManifestIdentity(identity);
		if (!manifestIdentity.version.trim()) throw new Error("Vehicle version must not be empty");
		this.identity = Object.freeze({
			...manifestIdentity,
			...(manifestIdentity.guidance ? { guidance: Object.freeze([...manifestIdentity.guidance]) } : {}),
		});
	}

	setExecutionPolicy(policy: VehicleExecutionPolicy): void {
		if (this.executionPolicy) throw new Error("Vehicle execution policy is already configured");
		this.executionPolicy = policy;
	}

	/** Includes an unexpected handler/policy exception's message in toFailure().causeMessage. Only enable once this Vehicle's own handlers are reviewed for leak risk. */
	setExposeHandlerFailureDetails(enabled: boolean): void {
		this.exposeHandlerFailureDetails = enabled;
	}

	/** See VehicleApprovalPolicyManager.configure -- delegates entirely, injecting this
	 * registry's own register()/registerEvent()/emit() as the manager's only real coupling
	 * back to the rest of the registry. */
	configureApprovals(options: Parameters<VehicleApprovalPolicyManager["configure"]>[0] = {}): void {
		if (this.approvalManager) throw new Error("Vehicle approval policy is already configured");
		this.approvalManager = new VehicleApprovalPolicyManager({
			register: (owner, binding) => this.register(owner, binding),
			registerEvent: (owner, event) => this.registerEvent(owner, event),
			emit: (name, version, payload) => this.emit(name, version, payload),
		});
		this.approvalManager.configure(options);
	}

	/** See VehicleApprovalPolicyManager.update. */
	updateApprovalPolicy(patch: Parameters<VehicleApprovalPolicyManager["update"]>[0]): void {
		if (!this.approvalManager) throw new Error("Vehicle approval policy is not configured -- call configureApprovals() first");
		this.approvalManager.update(patch);
	}

	/**
	 * The single source of truth for "does invoking this operation right now require
	 * approval" -- consulted by both enforceApprovalGate() (to decide whether to actually
	 * gate) and manifest() (to report the live answer as VehicleManifestOperation's own
	 * approvalRequired field, so a client re-fetching the manifest sees a policy change
	 * with no separate sync mechanism needed). False whenever approvals were never
	 * configured at all -- see VehicleApprovalPolicyManager.resolvesToApprovalRequired for
	 * the rest of the logic once they are.
	 */
	private resolvesToApprovalRequired(descriptor: VehicleOperationDescriptor): boolean {
		return this.approvalManager?.resolvesToApprovalRequired(descriptor) ?? false;
	}

	/** No-op when approvals were never configured -- see VehicleApprovalPolicyManager.enforceGate. */
	private enforceApprovalGate(
		key: string,
		descriptor: VehicleOperationDescriptor,
		principal: VehiclePrincipal | undefined,
		input: unknown,
		operationId: string,
		presentedCapability: string | undefined,
	): void {
		this.approvalManager?.enforceGate(key, descriptor, principal, input, operationId, presentedCapability);
	}

	register<Input, Output>(owner: string, binding: VehicleOperationBinding<Input, Output>): void {
		if (!owner.trim()) throw new Error("Vehicle operation owner must not be empty");
		const { operation } = binding;
		const { descriptor } = operation;
		const key = operationKey(descriptor.name, descriptor.version);
		const existing = this.registrations.get(key);
		if (existing) {
			throw new VehicleError("duplicate-owner", `${key} is already owned by ${existing.owner}; ${owner} cannot also register it`, {
				category: "conflict",
			});
		}
		const handler = binding.bind();
		this.registrations.set(key, {
			owner,
			descriptor,
			parseInput: (value, operationId) => parseWithSchema(operation.input, value, "input", descriptor, operationId),
			parseOutput: (value, operationId) => parseWithSchema(operation.output, value, "output", descriptor, operationId),
			invoke: (input, context) => {
				const typedInput = parseWithSchema(operation.input, input, "input", descriptor, context.operationId);
				const handlerContext: VehicleOperationContext<Input> = { ...context, input: typedInput };
				return handler(handlerContext);
			},
		});
	}

	ownerOf(name: string, version: number): string | undefined {
		return this.registrations.get(operationKey(name, version))?.owner;
	}

	/** Declares a named, schema'd event type a handler can later emit() -- delegates to the
	 * injected VehicleEventPubSub collaborator. */
	registerEvent<Payload>(owner: string, event: VehicleEvent<Payload>): void {
		this.eventPubSub.registerEvent(owner, event);
	}

	/** Delegates to the injected VehicleEventPubSub collaborator -- see its own doc comment. */
	emit(name: string, version: number, payload: unknown): void {
		this.eventPubSub.emit(name, version, payload);
	}

	/** Delegates to the injected VehicleEventPubSub collaborator -- see its own doc comment. */
	subscribeLocal(name: string, version: number, listener: (payload: unknown) => void): () => void {
		return this.eventPubSub.subscribeLocal(name, version, listener);
	}

	/** Delegates to the injected VehicleEventPubSub collaborator -- see its own doc comment. */
	subscribeAll(listener: (name: string, version: number, payload: unknown) => void): () => void {
		return this.eventPubSub.subscribeAll(listener);
	}

	/**
	 * Marks a registered operation available or unavailable on this running
	 * instance -- e.g. a provider whose credential just got configured or
	 * removed. There is no unregister(): an operation's shape is permanent
	 * once registered (mirroring Pi's own tool model, which has no
	 * unregisterTool() either), only its usability toggles. invoke() refuses
	 * an unavailable operation; manifest() reports it with available:false so
	 * a client-side projection (see vehicle-pi.ts) can hide it from the LLM
	 * before ever attempting a call.
	 */
	setAvailability(name: string, version: number, available: boolean, reason?: string): void {
		const key = operationKey(name, version);
		if (!this.registrations.has(key)) throw new Error(`Cannot set availability for unregistered Vehicle operation ${key}`);
		this.availability.set(key, { available, reason });
	}

	manifest(): VehicleManifest {
		return {
			...this.identity,
			operations: [...this.registrations.values()].map((registration) => {
				const key = operationKey(registration.descriptor.name, registration.descriptor.version);
				const state = this.availability.get(key);
				return {
					...registration.descriptor,
					available: state?.available ?? true,
					...(state?.reason ? { unavailableReason: state.reason } : {}),
					approvalRequired: this.resolvesToApprovalRequired(registration.descriptor),
				};
			}),
			events: this.eventPubSub.descriptors(),
		};
	}

	async invoke(name: string, version: number, input: unknown, options: VehicleInvocationOptions = {}): Promise<unknown> {
		const operationId = options.operationId ?? randomUUID();
		const key = operationKey(name, version);
		const registration = this.registrations.get(key);
		if (!registration) {
			throw new VehicleError("not-found", `No Vehicle operation is registered for ${key}`, {
				category: "not_found",
				operationId,
			});
		}
		const availability = this.availability.get(key);
		if (availability?.available === false) {
			throw new VehicleError("operation-unavailable", availability.reason ?? `${key} is currently unavailable`, {
				category: "unavailable",
				operationId,
				retryable: true,
			});
		}

		enforcePayloadSize(input, registration.descriptor.limits.maxRequestBytes, "request", key, operationId);
		const granted = new Set(options.permissions ?? []);
		const missing = registration.descriptor.permissions.filter((permission) => !granted.has(permission));
		if (missing.length > 0) {
			throw new VehicleError("permission-denied", `${key} requires permissions: ${missing.join(", ")}`, {
				category: "authorization",
				operationId,
				details: { missing },
			});
		}

		this.enforceApprovalGate(key, registration.descriptor, options.principal, input, operationId, options.approvalCapability);

		if (registration.descriptor.idempotency.mode === "keyed" && !options.idempotencyKey?.trim()) {
			throw new VehicleError("idempotency-key-required", `${key} requires an idempotency key`, {
				category: "validation",
				operationId,
			});
		}
		const parsedInput = registration.parseInput(input, operationId);
		const deadline = effectiveDeadline(registration.descriptor, options.deadline);
		const timeoutMs = deadline - Date.now();
		if (deadline <= Date.now()) {
			throw new VehicleError("deadline-exceeded", `${key} deadline has already elapsed`, {
				category: "timeout",
				operationId,
			});
		}
		const signals = [AbortSignal.timeout(Math.max(1, deadline - Date.now()))];
		if (options.signal) signals.push(options.signal);
		const signal = AbortSignal.any(signals);
		const context: InvocationContext = {
			operationId,
			correlationId: options.correlationId,
			callerSessionId: options.callerSessionId,
			callerProjectRoot: options.callerProjectRoot,
			signal,
			deadline,
			permissions: Object.freeze([...(options.permissions ?? [])]),
			principal: options.principal,
			idempotencyKey: options.idempotencyKey,
			expectedRevision: options.expectedRevision,
			approvalCapability: options.approvalCapability,
			reportProgress: (progress) => {
				enforcePayloadSize(progress, registration.descriptor.limits.maxResponseBytes, "response", key, operationId);
				options.onProgress?.(progress);
			},
		};

		const invoke = async (candidate: unknown): Promise<unknown> => {
			try {
				enforcePayloadSize(candidate, registration.descriptor.limits.maxRequestBytes, "request", key, operationId);
				return await registration.invoke(candidate, context);
			} catch (error) {
				if (isVehicleError(error)) throw error;
				if (signal.aborted) throw abortError(signal, deadline, operationId, key, timeoutMs);
				throw new VehicleError(
					"handler-failed",
					unexpectedFailureMessage(`${key} handler failed`, error, this.exposeHandlerFailureDetails),
					{ category: "internal", operationId, cause: error, exposeCause: this.exposeHandlerFailureDetails },
				);
			}
		};
		const request: VehicleExecutionRequest = {
			operation: registration.descriptor,
			input: parsedInput,
			operationId,
			correlationId: context.correlationId,
			callerSessionId: context.callerSessionId,
			callerProjectRoot: context.callerProjectRoot,
			signal,
			deadline,
			permissions: context.permissions,
			principal: context.principal,
			idempotencyKey: context.idempotencyKey,
			expectedRevision: context.expectedRevision,
			approvalCapability: context.approvalCapability,
		};
		const pending = (async (): Promise<unknown> => {
			try {
				return this.executionPolicy ? await this.executionPolicy.execute(request, invoke) : await invoke(parsedInput);
			} catch (error) {
				if (isVehicleError(error)) throw error;
				throw new VehicleError(
					"policy-failed",
					unexpectedFailureMessage(`${key} execution policy failed`, error, this.exposeHandlerFailureDetails),
					{ category: "internal", operationId, cause: error, exposeCause: this.exposeHandlerFailureDetails },
				);
			}
		})();
		const output = await awaitWithSignal(pending, signal, deadline, operationId, key, timeoutMs);
		enforcePayloadSize(output, registration.descriptor.limits.maxResponseBytes, "response", key, operationId);
		return registration.parseOutput(output, operationId);
	}

	/** Same validation as invoke(), minus awaiting the handler -- the seam VehicleJobStore needs. Kept separate so it can't regress invoke()'s tested behavior. */
	resolveForBackground(
		name: string,
		version: number,
		input: unknown,
		options: VehicleBackgroundResolutionOptions = {},
	): VehicleBackgroundResolution {
		const operationId = options.operationId ?? randomUUID();
		const key = operationKey(name, version);
		const registration = this.registrations.get(key);
		if (!registration) {
			throw new VehicleError("not-found", `No Vehicle operation is registered for ${key}`, { category: "not_found", operationId });
		}
		const background = registration.descriptor.background;
		if (!background) {
			throw new VehicleError("background-not-supported", `${key} does not support background execution`, {
				category: "validation",
				operationId,
			});
		}
		const availability = this.availability.get(key);
		if (availability?.available === false) {
			throw new VehicleError("operation-unavailable", availability.reason ?? `${key} is currently unavailable`, {
				category: "unavailable",
				operationId,
				retryable: true,
			});
		}

		enforcePayloadSize(input, registration.descriptor.limits.maxRequestBytes, "request", key, operationId);
		const granted = new Set(options.permissions ?? []);
		const missing = registration.descriptor.permissions.filter((permission) => !granted.has(permission));
		if (missing.length > 0) {
			throw new VehicleError("permission-denied", `${key} requires permissions: ${missing.join(", ")}`, {
				category: "authorization",
				operationId,
				details: { missing },
			});
		}
		this.enforceApprovalGate(key, registration.descriptor, options.principal, input, operationId, options.approvalCapability);
		if (registration.descriptor.idempotency.mode === "keyed" && !options.idempotencyKey?.trim()) {
			throw new VehicleError("idempotency-key-required", `${key} requires an idempotency key`, {
				category: "validation",
				operationId,
			});
		}
		const parsedInput = registration.parseInput(input, operationId);

		return Object.freeze({
			descriptor: registration.descriptor,
			background,
			operationId,
			parsedInput,
			run: async (context: VehicleOperationContext<unknown>): Promise<unknown> => {
				let output: unknown;
				try {
					output = await registration.invoke(parsedInput, context);
				} catch (error) {
					if (isVehicleError(error)) throw error;
					if (context.signal.aborted) {
						throw abortError(context.signal, context.deadline, operationId, key, context.deadline - Date.now());
					}
					throw new VehicleError(
						"handler-failed",
						unexpectedFailureMessage(`${key} handler failed`, error, this.exposeHandlerFailureDetails),
						{ category: "internal", operationId, cause: error, exposeCause: this.exposeHandlerFailureDetails },
					);
				}
				enforcePayloadSize(output, registration.descriptor.limits.maxResponseBytes, "response", key, operationId);
				return registration.parseOutput(output, operationId);
			},
		});
	}
}

/**
 * Forwards every event a registry emits onto a PushChannel-shaped publish
 * sink, under the shared vehicleEventTopic() naming convention
 * RemoteVehicleClient.subscribe() expects -- the remote-delivery half of
 * Vehicle Events. Call once at composition-root time, after the registry's
 * providers have registered (or before -- subscribeAll() catches every
 * future emit() too, regardless of registration order). Returns a teardown
 * matching subscribeAll()'s own unsubscribe shape.
 *
 * Takes a structural VehicleEventPublisher, not a concrete PushChannel
 * import -- PushChannel already satisfies this with its own publish()
 * method, so a daemon wires this as
 * `bridgeVehicleEventsToPushChannel(registry, pushChannel)` with zero
 * extra glue, while this file itself stays free of a cross-build-config
 * dependency on push-channel.ts (a separate tsconfig entry point).
 */
export function bridgeVehicleEventsToPushChannel(registry: VehicleRegistry, publisher: VehicleEventPublisher): () => void {
	return registry.subscribeAll((name, version, payload) => {
		publisher.publish(vehicleEventTopic(name, version), payload);
	});
}
