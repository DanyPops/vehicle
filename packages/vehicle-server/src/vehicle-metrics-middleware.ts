/**
 * Wraps every real Vehicle operation invocation with a metrics recording -- via the registry's
 * existing, general-purpose VehicleExecutionMiddleware extensibility point (useExecutionMiddleware),
 * so this needs zero changes to VehicleRegistry itself. Captures every caller (Pi, a CLI, another
 * Vehicle, a remote client), not just Pi -- the ground truth for "how much is this operation used."
 *
 * Never alters the real call's own outcome: a metrics-recording failure is swallowed (logged to
 * stderr, best-effort) rather than turning a successful operation call into a failed one, or
 * masking a real failure's own error.
 */
import { isVehicleError } from "@danypops/vehicle-core";
// Literal .ts extension (not .js), same convention as daemon-lifecycle.ts's own import of
// daemon.ts -- this file is exported as raw source (see the ./storage-dependency rationale in
// vehicle-metrics-store.ts's own header), while vehicle-registry.ts is part of the built dist
// set; the literal .ts specifier resolves to real source under any runtime (Bun natively, a
// TS-aware Node loader) regardless of that difference.
import type { VehicleExecutionMiddleware, VehicleExecutionRequest } from "./vehicle-registry.ts";
import type { VehicleMetricsStore } from "./vehicle-metrics-store.js";

/** Distinct id namespace per vehicleName -- useExecutionMiddleware() rejects a duplicate id, and a process can host more than one VehicleRegistry (rare, but not disallowed). */
export function vehicleMetricsMiddlewareId(vehicleName: string): string {
	return `vehicle-metrics:${vehicleName}`;
}

function safeRecord(store: VehicleMetricsStore, input: Parameters<VehicleMetricsStore["record"]>[0]): void {
	try {
		store.record(input);
	} catch (error) {
		// Best-effort: a metrics-store write failure (e.g. a full disk) must never affect a real
		// operation call's own success/failure -- matches activity-broker.ts's own "never throws"
		// contract for cross-cutting telemetry.
		console.error(`vehicle-metrics: failed to record an invocation for "${input.vehicleName}:${input.toolName}"`, error);
	}
}

export function createVehicleMetricsMiddleware(store: VehicleMetricsStore, vehicleName: string): VehicleExecutionMiddleware {
	return {
		id: vehicleMetricsMiddlewareId(vehicleName),
		async intercept(request: VehicleExecutionRequest, next: (effectiveInput: unknown) => Promise<unknown>): Promise<unknown> {
			const start = Date.now();
			try {
				const result = await next(request.input);
				safeRecord(store, {
					source: "server",
					vehicleName,
					toolName: request.operation.name,
					operationVersion: request.operation.version,
					outcome: "success",
					durationMs: Date.now() - start,
					callerSessionId: request.callerSessionId,
					callerProjectRoot: request.callerProjectRoot,
					principalId: request.principal?.id,
				});
				return result;
			} catch (error) {
				safeRecord(store, {
					source: "server",
					vehicleName,
					toolName: request.operation.name,
					operationVersion: request.operation.version,
					outcome: "failure",
					errorCode: isVehicleError(error) ? error.code : undefined,
					durationMs: Date.now() - start,
					callerSessionId: request.callerSessionId,
					callerProjectRoot: request.callerProjectRoot,
					principalId: request.principal?.id,
				});
				throw error;
			}
		},
	};
}
