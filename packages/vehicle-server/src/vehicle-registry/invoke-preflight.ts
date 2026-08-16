/**
 * Spike (Papyrus task 9e5a404d): VehicleRegistry.invoke()'s own preflight gate chain -- the ~8
 * sequential, independently fallible checks a call must pass before its handler ever runs
 * (registration lookup, availability, request payload size, permissions, approval, idempotency
 * key, input parsing, deadline) -- rewritten with better-result's Result.gen/TaggedError/.match(),
 * to evaluate whether the idiom genuinely improves a real handler with nested fallible steps
 * before recommending it anywhere else. Scope is deliberately internal-only: invoke()'s own public
 * behavior, thrown VehicleError shapes/codes/categories, and check order are all unchanged --
 * see throwForInvokePreflightError for the single boundary translation back to today's contract.
 *
 * Not touched: resolveForBackground()'s own, nearly-identical preflight sequence. Unifying the two
 * would be propagating this spike to a second handler, which is explicitly out of scope.
 */
import type { VehicleInvocationOptions, VehicleOperationDescriptor, VehiclePrincipal } from "@danypops/vehicle-core";
import { VehicleError } from "@danypops/vehicle-core";
import { Result, TaggedError } from "better-result";

/** Structural subset of VehicleRegistry's own private Registration record -- everything this preflight chain actually touches, nothing more (kept generic in runInvokePreflight so the caller's own richer Registration type round-trips through InvokePreflightResult unchanged). */
export interface PreflightRegistration {
	readonly descriptor: VehicleOperationDescriptor;
	parseInput(value: unknown, operationId: string): unknown;
}

/** Structural subset of VehicleRegistry's own private AvailabilityState record. */
export interface PreflightAvailabilityState {
	readonly available: boolean;
	readonly reason?: string;
}

export class PreflightNotFound extends TaggedError("PreflightNotFound")<{
	readonly key: string;
	readonly operationId: string;
	readonly message: string;
}> {}

export class PreflightUnavailable extends TaggedError("PreflightUnavailable")<{
	readonly key: string;
	readonly operationId: string;
	readonly reason?: string;
	readonly message: string;
}> {}

export class PreflightPermissionDenied extends TaggedError("PreflightPermissionDenied")<{
	readonly key: string;
	readonly operationId: string;
	readonly missing: readonly string[];
	readonly message: string;
}> {}

export class PreflightIdempotencyKeyRequired extends TaggedError("PreflightIdempotencyKeyRequired")<{
	readonly key: string;
	readonly operationId: string;
	readonly message: string;
}> {}

export class PreflightDeadlineExceeded extends TaggedError("PreflightDeadlineExceeded")<{
	readonly key: string;
	readonly operationId: string;
	readonly message: string;
}> {}

/**
 * Wraps whatever the underlying enforcePayloadSize/enforceApprovalGate/parseInput steps actually
 * threw. Every real code path today already throws a fully-formed VehicleError from each of those
 * three -- but this preserves "rethrow exactly what was thrown", not "assume it's always a
 * VehicleError", so an unanticipated exception shape still propagates completely unchanged (see
 * throwForInvokePreflightError) rather than getting silently reshaped into a new failure mode.
 */
export class PreflightUnderlyingFailure extends TaggedError("PreflightUnderlyingFailure")<{
	readonly cause: unknown;
}> {}

export type InvokePreflightError =
	| PreflightNotFound
	| PreflightUnavailable
	| PreflightPermissionDenied
	| PreflightIdempotencyKeyRequired
	| PreflightDeadlineExceeded
	| PreflightUnderlyingFailure;

export interface InvokePreflightResult<R extends PreflightRegistration> {
	readonly registration: R;
	readonly parsedInput: unknown;
	readonly deadline: number;
	readonly timeoutMs: number;
}

export interface InvokePreflightOptions<R extends PreflightRegistration> {
	readonly registrations: ReadonlyMap<string, R>;
	readonly availability: ReadonlyMap<string, PreflightAvailabilityState>;
	readonly key: string;
	readonly input: unknown;
	readonly operationId: string;
	readonly invocation: VehicleInvocationOptions;
	readonly enforcePayloadSize: (value: unknown, maxBytes: number, kind: "request" | "response", key: string, operationId: string) => void;
	readonly effectiveDeadline: (descriptor: VehicleOperationDescriptor, requested: number | undefined) => number;
	readonly enforceApprovalGate: (
		key: string,
		descriptor: VehicleOperationDescriptor,
		principal: VehiclePrincipal | undefined,
		input: unknown,
		operationId: string,
		presentedCapability: string | undefined,
	) => void;
}

function findRegistration<R extends PreflightRegistration>(
	registrations: ReadonlyMap<string, R>,
	key: string,
	operationId: string,
): Result<R, PreflightNotFound> {
	const registration = registrations.get(key);
	return registration === undefined
		? Result.err(new PreflightNotFound({ key, operationId, message: `No Vehicle operation is registered for ${key}` }))
		: Result.ok(registration);
}

function checkAvailable(
	availability: ReadonlyMap<string, PreflightAvailabilityState>,
	key: string,
	operationId: string,
): Result<void, PreflightUnavailable> {
	const state = availability.get(key);
	return state?.available === false
		? Result.err(
				new PreflightUnavailable({
					key,
					operationId,
					reason: state.reason,
					message: state.reason ?? `${key} is currently unavailable`,
				}),
			)
		: Result.ok(undefined);
}

function checkPermissions(
	descriptor: VehicleOperationDescriptor,
	granted: ReadonlySet<string>,
	key: string,
	operationId: string,
): Result<void, PreflightPermissionDenied> {
	const missing = descriptor.permissions.filter((permission) => !granted.has(permission));
	return missing.length > 0
		? Result.err(
				new PreflightPermissionDenied({ key, operationId, missing, message: `${key} requires permissions: ${missing.join(", ")}` }),
			)
		: Result.ok(undefined);
}

function checkIdempotencyKey(
	descriptor: VehicleOperationDescriptor,
	idempotencyKey: string | undefined,
	key: string,
	operationId: string,
): Result<void, PreflightIdempotencyKeyRequired> {
	return descriptor.idempotency.mode === "keyed" && !idempotencyKey?.trim()
		? Result.err(new PreflightIdempotencyKeyRequired({ key, operationId, message: `${key} requires an idempotency key` }))
		: Result.ok(undefined);
}

function checkDeadlineNotElapsed(deadline: number, key: string, operationId: string): Result<void, PreflightDeadlineExceeded> {
	return deadline <= Date.now()
		? Result.err(new PreflightDeadlineExceeded({ key, operationId, message: `${key} deadline has already elapsed` }))
		: Result.ok(undefined);
}

/**
 * Deliberately not Result.try({ try, catch }) here: its generic signature (try: (context: TryContext) => Awaited<A>)
 * fights generic inference when wrapped inside another generic helper like this one -- TypeScript cannot prove an
 * arbitrary T extends Awaited<T> even though none of this chain's steps are ever actually async. A plain try/catch
 * is simpler and exactly as correct for a synchronous step.
 */
function tryStep<T>(fn: () => T): Result<T, PreflightUnderlyingFailure> {
	try {
		return Result.ok(fn());
	} catch (cause) {
		return Result.err(new PreflightUnderlyingFailure({ cause }));
	}
}

/**
 * The full preflight gate chain, composed with Result.gen -- every yield* either unwraps an Ok
 * and continues, or short-circuits the whole chain on the first Err, exactly mirroring the
 * imperative if-throw sequence this replaces, in the same order, carrying the same distinguishing
 * information into each failure. Purely synchronous, matching the original: none of these checks
 * were ever async, so there's no need for Result.gen's async-generator/Result.await form here.
 */
export function runInvokePreflight<R extends PreflightRegistration>(
	options: InvokePreflightOptions<R>,
): Result<InvokePreflightResult<R>, InvokePreflightError> {
	return Result.gen(function* () {
		const registration = yield* findRegistration(options.registrations, options.key, options.operationId);
		yield* checkAvailable(options.availability, options.key, options.operationId);
		yield* tryStep(() =>
			options.enforcePayloadSize(
				options.input,
				registration.descriptor.limits.maxRequestBytes,
				"request",
				options.key,
				options.operationId,
			),
		);
		const granted = new Set(options.invocation.permissions ?? []);
		yield* checkPermissions(registration.descriptor, granted, options.key, options.operationId);
		yield* tryStep(() =>
			options.enforceApprovalGate(
				options.key,
				registration.descriptor,
				options.invocation.principal,
				options.input,
				options.operationId,
				options.invocation.approvalCapability,
			),
		);
		yield* checkIdempotencyKey(registration.descriptor, options.invocation.idempotencyKey, options.key, options.operationId);
		const parsedInput = yield* tryStep(() => registration.parseInput(options.input, options.operationId));
		const deadline = options.effectiveDeadline(registration.descriptor, options.invocation.deadline);
		const timeoutMs = deadline - Date.now();
		yield* checkDeadlineNotElapsed(deadline, options.key, options.operationId);
		return Result.ok({ registration, parsedInput, deadline, timeoutMs });
	});
}

/**
 * Translates an InvokePreflightError back into the single thrown VehicleError invoke()'s own
 * callers have always seen -- the boundary this spike's own task description calls for. Every
 * branch reproduces today's exact code/message/category/details. PreflightUnderlyingFailure is
 * handled before the exhaustive match rather than inside it: it isn't a new failure shape to
 * translate, only a pass-through of whatever the wrapped step already threw, and TaggedError's
 * own `.is()` guard narrows the match's remaining union to exactly the five real translations.
 */
export function throwForInvokePreflightError(error: InvokePreflightError): never {
	if (PreflightUnderlyingFailure.is(error)) throw error.cause;
	throw error.match({
		PreflightNotFound: (e) => new VehicleError("not-found", e.message, { category: "not_found", operationId: e.operationId }),
		PreflightUnavailable: (e) =>
			new VehicleError("operation-unavailable", e.message, { category: "unavailable", operationId: e.operationId, retryable: true }),
		PreflightPermissionDenied: (e) =>
			new VehicleError("permission-denied", e.message, {
				category: "authorization",
				operationId: e.operationId,
				details: { missing: e.missing },
			}),
		PreflightIdempotencyKeyRequired: (e) =>
			new VehicleError("idempotency-key-required", e.message, { category: "validation", operationId: e.operationId }),
		PreflightDeadlineExceeded: (e) => new VehicleError("deadline-exceeded", e.message, { category: "timeout", operationId: e.operationId }),
	});
}
