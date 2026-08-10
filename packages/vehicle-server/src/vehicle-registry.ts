import { randomUUID } from "node:crypto";
import type {
	VehicleApprovalAuthority,
	VehicleApprovalRequest,
	VehicleBackgroundCapability,
	VehicleEffect,
	VehicleEvent,
	VehicleEventDescriptor,
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
import {
	bindVehicleOperation,
	boundedCauseMessage,
	boundedValidationDetails,
	DEFAULT_APPROVAL_EFFECTS,
	DEFAULT_APPROVAL_TIMEOUT_MS,
	defineVehicleOperation,
	defineVehicleSchema,
	isVehicleError,
	VEHICLE_APPROVAL_RESOLVE_OPERATION_NAME,
	VehicleError,
	vehicleApprovalRequestedEvent,
	vehicleApprovalResolvedEvent,
	vehicleEventTopic,
} from "@danypops/vehicle-core";
import { HmacApprovalAuthority, hashApprovalInput } from "./vehicle-approval-authority.js";
import { readPackageVersion } from "./version.js";

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

interface EventRegistration {
	readonly owner: string;
	readonly descriptor: VehicleEventDescriptor;
	parsePayload(value: unknown, eventId: string): unknown;
	readonly listeners: Set<(payload: unknown) => void>;
}

/** A publish(topic, payload) sink -- PushChannel satisfies this structurally with zero import needed; see bridgeVehicleEventsToPushChannel below. */
export interface VehicleEventPublisher {
	publish(topic: string, payload: unknown): void;
}

function operationKey(name: string, version: number): string {
	return `${name}@${version}`;
}

function eventKey(name: string, version: number): string {
	return `${name}@${version}`;
}

/** Bounds a single event's local listener set the same way PushChannel bounds its own connections/topics -- defense in depth against an unbounded subscribe() loop, not a limit any real single-bridge-plus-a-few-widgets usage should ever approach. */
const MAX_LISTENERS_PER_EVENT = 64;

/** Bounds how many gated invoke()s can be simultaneously awaiting a human/authority decision -- the same bounded-resource discipline as every other Vehicle capacity limit. */
const MAX_PENDING_APPROVALS = 256;

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

function parseEventPayload<T>(schema: VehicleSchemaCodec<T>, value: unknown, descriptor: VehicleEventDescriptor, eventId: string): T {
	let result: VehicleSchemaResult<T>;
	const key = eventKey(descriptor.name, descriptor.version);
	try {
		result = schema.safeParse(value);
	} catch (error) {
		throw new VehicleError("invalid-payload", `${key} received an invalid event payload`, {
			category: "validation",
			operationId: eventId,
			cause: error,
		});
	}
	if (!result.success) {
		throw new VehicleError("invalid-payload", `${key} received an invalid event payload`, {
			category: "validation",
			operationId: eventId,
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

/** Patch accepted by {@link VehicleRegistry.updateApprovalPolicy} -- every field optional, only what's provided changes. */
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
 * Kept separate from `./http`'s `createVehicleHttpApp()` (which exposes a
 * registry over `GET /vehicle/manifest`, `POST /vehicle/invoke`, and
 * `POST /vehicle/cancel`) on purpose: a consumer that only builds/tests a
 * registry never pulls in HTTP request/response plumbing.
 */
export class VehicleRegistry {
	private readonly registrations = new Map<string, Registration>();
	private readonly availability = new Map<string, AvailabilityState>();
	private readonly identity: VehicleManifestIdentity;
	private readonly events = new Map<string, EventRegistration>();
	private readonly wildcardListeners = new Set<(name: string, version: number, payload: unknown) => void>();
	private approvalPolicy?: ApprovalPolicy;
	private readonly pendingApprovals = new Map<string, VehicleApprovalRequest>();
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

	/**
	 * Opt-in only -- never called automatically, so a Vehicle that never
	 * configures approvals keeps today's exact manifest shape and invoke()
	 * behavior (no gating at all). Registers the two built-in approval
	 * events and the vehicle.approval.resolve operation at call time (not
	 * construction), so they only ever appear in a manifest for a Vehicle
	 * that actually uses them.
	 */
	configureApprovals(options: VehicleApprovalPolicyOptions = {}): void {
		if (this.approvalPolicy) throw new Error("Vehicle approval policy is already configured");
		this.approvalPolicy = {
			requireApprovalForEffects: new Set(options.requireApprovalForEffects ?? DEFAULT_APPROVAL_EFFECTS),
			authority: options.authority ?? new HmacApprovalAuthority(),
			timeoutMs: options.timeoutMs ?? DEFAULT_APPROVAL_TIMEOUT_MS,
			enabled: options.enabled ?? true,
		};
		this.registerEvent("vehicle-registry", vehicleApprovalRequestedEvent);
		this.registerEvent("vehicle-registry", vehicleApprovalResolvedEvent);
		this.registerApprovalResolveOperation();
	}

	/**
	 * Live update to an already-configured approval policy -- unlike configureApprovals()
	 * itself (a one-shot: it also registers events/the resolve operation, which can't be
	 * registered twice), this only ever touches the mutable policy fields and can be called
	 * any number of times. An already-pending approval request (recorded under whatever
	 * policy existed when enforceApprovalGate() first saw it) is unaffected -- it resolves
	 * or expires under the policy in effect at that time, the same way it already would if
	 * nothing here ever changed.
	 */
	updateApprovalPolicy(patch: VehicleApprovalPolicyUpdate): void {
		if (!this.approvalPolicy) throw new Error("Vehicle approval policy is not configured -- call configureApprovals() first");
		this.approvalPolicy = {
			...this.approvalPolicy,
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

		this.register(
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

		const capability = input.decision === "granted" ? this.approvalPolicy?.authority.mint(request) : undefined;
		this.emit(vehicleApprovalResolvedEvent.descriptor.name, vehicleApprovalResolvedEvent.descriptor.version, {
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
	 * approval" -- consulted by both enforceApprovalGate() (to decide whether to actually
	 * gate) and manifest() (to report the live answer as VehicleManifestOperation's own
	 * approvalRequired field, so a client re-fetching the manifest sees a policy change
	 * with no separate sync mechanism needed). False whenever the registry's approval
	 * policy was never configured, or was configured but is currently disabled
	 * (VehicleApprovalPolicyOptions.enabled / updateApprovalPolicy). Otherwise: the
	 * operation's own requiresApproval override when it set one, else the effect-derived
	 * default against the policy's requireApprovalForEffects set.
	 */
	private resolvesToApprovalRequired(descriptor: VehicleOperationDescriptor): boolean {
		const policy = this.approvalPolicy;
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
	private enforceApprovalGate(
		key: string,
		descriptor: VehicleOperationDescriptor,
		principal: VehiclePrincipal | undefined,
		input: unknown,
		operationId: string,
		presentedCapability: string | undefined,
	): void {
		if (!this.resolvesToApprovalRequired(descriptor)) return;
		const policy = this.approvalPolicy as ApprovalPolicy;
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
		this.emit(vehicleApprovalRequestedEvent.descriptor.name, vehicleApprovalRequestedEvent.descriptor.version, request);
		throw new VehicleError("approval-required", `${key} requires approval before it can run`, {
			category: "authorization",
			operationId,
			retryable: true,
			details: { requestId, expiresAt },
		});
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

	/** Declares a named, schema'd event type a handler can later emit() -- the typed replacement for a raw PushChannel.publish() call with a hand-invented topic string. */
	registerEvent<Payload>(owner: string, event: VehicleEvent<Payload>): void {
		if (!owner.trim()) throw new Error("Vehicle event owner must not be empty");
		const { descriptor } = event;
		const key = eventKey(descriptor.name, descriptor.version);
		const existing = this.events.get(key);
		if (existing) {
			throw new VehicleError("duplicate-owner", `${key} is already owned by ${existing.owner}; ${owner} cannot also register it`, {
				category: "conflict",
			});
		}
		this.events.set(key, {
			owner,
			descriptor,
			parsePayload: (value, eventId) => parseEventPayload(event.payload, value, descriptor, eventId),
			listeners: new Set(),
		});
	}

	/**
	 * Validates payload against the declared event's own schema and byte-size
	 * limit (same bounded-resource discipline invoke() applies to a
	 * request/response), then notifies every current local listener --
	 * both a direct subscribeLocal() caller (LocalVehicleClient) and any
	 * wildcard bridge (subscribeAll(), e.g. bridgeVehicleEventsToPushChannel
	 * for remote delivery). A throwing listener is swallowed so one bad
	 * subscriber can never break emit() for every other subscriber or the
	 * handler that's emitting.
	 */
	emit(name: string, version: number, payload: unknown): void {
		const key = eventKey(name, version);
		const registration = this.events.get(key);
		if (!registration) {
			throw new VehicleError("not-found", `No Vehicle event is registered for ${key}`, { category: "not_found" });
		}
		const eventId = randomUUID();
		const parsed = registration.parsePayload(payload, eventId);
		enforcePayloadSize(parsed, registration.descriptor.maxPayloadBytes, "response", key, eventId);
		for (const listener of registration.listeners) {
			try {
				listener(parsed);
			} catch {
				// Best-effort fan-out -- see the doc comment above.
			}
		}
		for (const listener of this.wildcardListeners) {
			try {
				listener(name, version, parsed);
			} catch {
				// Best-effort fan-out -- see the doc comment above.
			}
		}
	}

	/** In-process subscription to one declared event, scoped to a caller that already knows its exact name/version -- what LocalVehicleClient.subscribe() is built on. Throws not-found the same way invoke() does for an unregistered operation, rather than silently listening for something that can never fire. */
	subscribeLocal(name: string, version: number, listener: (payload: unknown) => void): () => void {
		const key = eventKey(name, version);
		const registration = this.events.get(key);
		if (!registration) {
			throw new VehicleError("not-found", `No Vehicle event is registered for ${key}`, { category: "not_found" });
		}
		if (registration.listeners.size >= MAX_LISTENERS_PER_EVENT) {
			throw new VehicleError("capacity-exceeded", `${key} already has the maximum of ${MAX_LISTENERS_PER_EVENT} local listeners`, {
				category: "capacity",
			});
		}
		registration.listeners.add(listener);
		return () => registration.listeners.delete(listener);
	}

	/** Every current and future emit(), regardless of event name -- the seam bridgeVehicleEventsToPushChannel uses so a bridge set up once forwards every event a provider declares, including ones registered after the bridge itself. */
	subscribeAll(listener: (name: string, version: number, payload: unknown) => void): () => void {
		this.wildcardListeners.add(listener);
		return () => this.wildcardListeners.delete(listener);
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
			events: [...this.events.values()].map((registration) => registration.descriptor),
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
