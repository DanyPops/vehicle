import { MutationOutcomeUnknownError, PreDispatchConnectionError } from "@danypops/vehicle-client/daemon-client";
import type { VehicleFailure, VehicleIdempotency, VehicleManifest, VehicleManifestOperation } from "@danypops/vehicle-core";
import { boundedCauseMessage, isVehicleError, type VehicleError } from "@danypops/vehicle-core";
import { reportClassificationFailure } from "./client-diagnostics.js";
import type { RegisteredPiVehicleTool, RegisterVehicleToolsOptions } from "./vehicle-pi.js";
import { permissionsSatisfied } from "./vehicle-pi-primitives.js";
import { classifyVehicleOperationSafety, type VehicleSafetyState } from "./vehicle-safety.js";
import { registerVehicleSafetyContributor } from "./vehicle-safety-registry.js";

/**
 * "Is this operation permitted, and how should a failure from it be classified/reported"
 * concerns, split out of vehicle-pi.ts's own kitchen-sink module: the local /safety policy
 * (permissions + effect + human override -> allow/ask/blocked) and Vehicle failure
 * classification/sanitization (turning a raw thrown error -- a real VehicleError, an ambiguous
 * transport failure, a totally opaque throw -- into one consistent VehicleFailure shape) are
 * distinct from manifest handshaking, job polling, and local approval prompting, but were all
 * previously interleaved in one 1575-line file.
 */

export function resolveSafetyState(
	manifestName: string,
	descriptor: VehicleManifestOperation,
	options: RegisterVehicleToolsOptions,
): VehicleSafetyState {
	return classifyVehicleOperationSafety({
		permissionsSatisfied: permissionsSatisfied(descriptor.permissions, options.permissions),
		effect: descriptor.effect,
		approvalRequired: descriptor.approvalRequired,
		requireApprovalForEffects: options.requireApprovalForEffects ? new Set(options.requireApprovalForEffects) : undefined,
		override: options.safetyPolicyStore?.get(manifestName, descriptor.name),
	});
}

/**
 * Unconditional, matching the Activity Broker's own convention -- /safety
 * sees every Vehicle a session has registered without any extension needing
 * to wire itself in separately. Re-registering under the same manifest name
 * (a refresh) simply replaces the prior contributor's resolve() closure.
 */
export function contributeToSafetyRegistry(manifest: VehicleManifest, tools: readonly RegisteredPiVehicleTool[]): void {
	registerVehicleSafetyContributor({
		source: manifest.name,
		resolve: () => ({
			vehicleName: manifest.name,
			tools: tools.map((tool) => ({
				toolName: tool.toolName,
				operationName: tool.operationName,
				effect: tool.effect,
				state: tool.safetyState,
			})),
		}),
	});
}

/** sanitizedFailure()'s own fallback code for a raw transport-level throw -- carries zero information on its own (every failure is "a vehicle client failed"), unlike a real domain code (not-found, validation, deadline-exceeded, ...) which is worth showing as-is. */
export const GENERIC_TRANSPORT_FAILURE_CODE = "vehicle-client-failed";

/**
 * Renders failure.details' own primitive fields (e.g. a capacity failure's { actualBytes,
 * maxBytes }) into the same parenthesized annotation causeMessage already gets -- undefined for
 * anything else (no details, a non-object, an array, or an object with no primitive fields),
 * since an arbitrary nested JsonValue isn't safe to inline into a one-line error message.
 */
function formatFailureDetails(details: VehicleFailure["details"]): string | undefined {
	if (details === undefined || details === null || typeof details !== "object" || Array.isArray(details)) return undefined;
	const parts = Object.entries(details)
		.filter((entry): entry is [string, string | number | boolean] => {
			const value = entry[1];
			return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
		})
		.map(([key, value]) => `${key}=${value}`);
	return parts.length === 0 ? undefined : parts.join(", ");
}

export class PiVehicleInvocationError extends Error {
	constructor(
		readonly failure: VehicleFailure,
		/** The failing Vehicle's own manifest name (e.g. "papyrus") -- substituted for the generic transport-failure code so the visible message says which backend failed instead of repeating a label that's true of every such failure. */
		vehicleName?: string,
	) {
		// causeMessage and details.{actualBytes,maxBytes} etc. were captured but never shown -- Pi
		// surfaces this .message, not .failure, so a capacity failure otherwise gives no way to know
		// how far over the cap the real payload was or what limit would fit.
		const label = failure.code === GENERIC_TRANSPORT_FAILURE_CODE && vehicleName ? vehicleName : failure.code;
		const annotations = [failure.causeMessage, formatFailureDetails(failure.details)].filter((part): part is string => part !== undefined);
		const annotation = annotations.length === 0 ? "" : ` (${annotations.join("; ")})`;
		super(`${label}: ${failure.message}${annotation}`);
		this.name = "PiVehicleInvocationError";
	}
}

/** vehicle-core, vehicle-client/daemon-client, and this module's own PiVehicleInvocationError are always real classes in a correctly resolved install -- but a real live incident (a broken/duplicated dependency resolution putting one of them at `undefined`) turned every classification below into an uncaught `TypeError: Right-hand side of 'instanceof' is not an object`, crashing every single Vehicle error response, not just the one that first hit it. Treating a non-function right-hand side as simply "doesn't match" instead of throwing is the actual fix; classifyKnownFailure's own outer try/catch below is defense-in-depth for anything else this narrow guard doesn't cover (e.g. a poisoned prototype chain on `error` itself). */
function safeInstanceOf(value: unknown, ctor: unknown): boolean {
	return typeof ctor === "function" && value instanceof ctor;
}

/** The code sanitizedFailure() itself falls back to only when its own classification logic threw internally -- distinguishable from GENERIC_TRANSPORT_FAILURE_CODE (a real transport failure) so a caller/log can tell "the vehicle client has an internal bug" apart from "the network/daemon failed". Always paired with reportClassificationFailure so the failure is actually diagnosable, not just silently downgraded. */
const CLASSIFICATION_FAILURE_CODE = "vehicle-client-classification-failed";

/**
 * Real gap fixed here (papyrus task d0eb81b7): a MutationOutcomeUnknownError is thrown
 * uniformly by createReconnectingVehicleClient's callOnce() for EVERY invoke(), regardless of
 * the operation's own declared idempotency.mode -- a deliberate, documented choice at that
 * generic wire-level layer, which has no visibility into any one operation's semantics. This
 * function DOES have that visibility (the caller already resolved `descriptor`), so it's the
 * right place to correct the caller-facing symptom: a `mode: "safe"` operation (a plain read,
 * e.g. tasks.run_gates) that hits this exact ambiguous-transport-failure path was previously
 * indistinguishable from a genuine mutation -- same non-retryable classification, same message
 * implying an idempotency-key-backed receipt exists to inspect, even though a safe operation
 * never files one and never needs to. There is zero duplicate-side-effect risk in simply
 * retrying a safe operation directly, so it's marked retryable here and told so accurately.
 */
export function classifyKnownFailure(error: unknown, idempotencyMode?: VehicleIdempotency["mode"]): VehicleFailure | undefined {
	// isVehicleError(), not `safeInstanceOf(error, VehicleError)`: the latter is a plain `instanceof`
	// check, which fails whenever the error was constructed against a *different* physical
	// @danypops/vehicle-core copy than the one this module imported -- a realistic outcome of
	// ordinary semver-range drift across sibling packages in a real dependency tree (confirmed
	// live: web-spider's own RemoteVehicleClient and vehicle-client-pi ended up with two vehicle-core
	// installs). isVehicleError() uses vehicle-core's own Symbol.for(...) global-registry brand
	// specifically so this recognizes a real VehicleError across duplicated installs; `instanceof`
	// silently fell through to the generic, detail-free "vehicle-client-failed" fallback instead,
	// discarding a real failure's own code/category/details.
	if (isVehicleError(error)) return (error as VehicleError).toFailure();
	if (safeInstanceOf(error, PiVehicleInvocationError)) return (error as PiVehicleInvocationError).failure;
	if (safeInstanceOf(error, MutationOutcomeUnknownError) || safeInstanceOf(error, PreDispatchConnectionError)) {
		const typed = error as MutationOutcomeUnknownError | PreDispatchConnectionError;
		const causeMessage = boundedCauseMessage(typed.cause);
		const isPreDispatch = safeInstanceOf(error, PreDispatchConnectionError);
		const isAmbiguousSafeRead = !isPreDispatch && idempotencyMode === "safe";
		return {
			code: typed.code,
			category: "unavailable",
			message: isAmbiguousSafeRead
				? `a safe, read-only operation's result could not be confirmed due to a transport failure -- safe to retry directly, no idempotency key needed${typed.operationId ? ` (${typed.operationId})` : ""}: ${typed.cause instanceof Error ? typed.cause.message : String(typed.cause)}`
				: typed.message,
			retryable: isPreDispatch || isAmbiguousSafeRead,
			...(typed.operationId ? { details: { operationId: typed.operationId } } : {}),
			...(causeMessage ? { causeMessage } : {}),
		};
	}
	return undefined;
}

export function sanitizedFailure(error: unknown, idempotencyMode?: VehicleIdempotency["mode"]): VehicleFailure {
	try {
		const known = classifyKnownFailure(error, idempotencyMode);
		if (known) return known;
	} catch (internalFailure) {
		reportClassificationFailure(error, internalFailure);
		return {
			code: CLASSIFICATION_FAILURE_CODE,
			category: "unavailable",
			message: "Vehicle client failed to classify an invocation error (see vehicle-client-pi diagnostics)",
			retryable: false,
		};
	}
	// This branch only ever sees a raw transport-level throw (a stale/dead connection, a fetch()
	// failure, a stream read error) -- never a domain rejection, which VehicleError already carries
	// its own opt-in exposeCause for. Node's fetch() populates a TypeError's .cause with the real
	// underlying reason (ECONNREFUSED, ECONNRESET, a DNS failure); a real live incident was
	// diagnosable only as the opaque top-level "fetch failed" until this was captured.
	const causeMessage = error instanceof Error ? boundedCauseMessage(error.cause) : undefined;
	return {
		code: GENERIC_TRANSPORT_FAILURE_CODE,
		category: "unavailable",
		message: error instanceof Error ? error.message : "Vehicle client invocation failed",
		retryable: false,
		...(causeMessage === undefined ? {} : { causeMessage }),
	};
}

export function approvalRequestId(failure: VehicleFailure): string | undefined {
	const details = failure.details;
	if (typeof details !== "object" || details === null || Array.isArray(details)) return undefined;
	const requestId = (details as { requestId?: unknown }).requestId;
	return typeof requestId === "string" ? requestId : undefined;
}
