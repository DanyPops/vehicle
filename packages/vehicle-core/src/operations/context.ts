import type { JsonValue } from "../schemas/json.js";

export interface VehiclePrincipal {
	readonly id: string;
	readonly claims?: Readonly<Record<string, JsonValue>>;
}

/**
 * callerSessionId/callerProjectRoot identify the real host session (e.g. one Pi TUI process) that
 * originated this call, and its working directory at call time -- a generic ownership/attribution
 * hook any operation handler can read (e.g. scoping a background subscription to the session or
 * project that created it), distinct from both:
 *  - correlationId: a caller-CHOSEN id deliberately meant to span several separate invoke() calls
 *    (a batch/business-transaction id), not an automatically-derived caller identity.
 *  - principal: broader identity/claims used for permission and approval decisions, usually a
 *    fixed per-extension value (e.g. {id: "pi-pipes"}), not a distinguishing per-session id.
 * A Pi projection layer (see vehicle-client-pi's invokeVehicleOperation) auto-derives both from
 * context.sessionManager.getSessionId()/context.cwd on every call, the same way it already
 * auto-derives correlationId -- a handler that never reads them pays nothing extra.
 */
export interface VehicleInvocationOptions {
	readonly operationId?: string;
	readonly correlationId?: string;
	readonly callerSessionId?: string;
	readonly callerProjectRoot?: string;
	readonly signal?: AbortSignal;
	readonly deadline?: number;
	readonly permissions?: readonly string[];
	readonly principal?: VehiclePrincipal;
	readonly idempotencyKey?: string;
	readonly expectedRevision?: string | number;
	readonly approvalCapability?: string;
	readonly onProgress?: (progress: unknown) => void;
}

export interface VehicleOperationContext<Input> {
	readonly input: Input;
	readonly operationId: string;
	readonly correlationId?: string;
	/** See VehicleInvocationOptions's own doc comment. */
	readonly callerSessionId?: string;
	/** See VehicleInvocationOptions's own doc comment. */
	readonly callerProjectRoot?: string;
	readonly signal: AbortSignal;
	readonly deadline: number;
	readonly permissions: readonly string[];
	readonly principal?: VehiclePrincipal;
	readonly idempotencyKey?: string;
	readonly expectedRevision?: string | number;
	readonly approvalCapability?: string;
	/** Set only for a job execution (VehicleJobStore.submit()); undefined for a plain invoke(). A handler that wants mid-flight input opts in with `for await (const input of context.steerInputs ?? [])`. */
	readonly steerInputs?: AsyncIterable<unknown>;
	reportProgress(progress: unknown): void;
}

export type VehicleOperationHandler<Input, Output> = (context: VehicleOperationContext<Input>) => Promise<Output>;
