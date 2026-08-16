import type { VehicleFailure } from "../errors/error.js";
import type { VehiclePrincipal } from "../operations/context.js";
import type { VehicleJobStatus, VehicleJobTerminationReason } from "./termination.js";
import type { VehicleJobNotifyMode, VehicleJobWakeBudget, VehicleJobWakeEntry } from "./wake-log.js";

/**
 * The client-facing wire shapes for Vehicle Jobs -- submit/poll/tail options and results, shared by
 * vehicle-server's VehicleJobStore (the orchestration side) and vehicle-client's job-capable clients
 * (the calling side), so both halves of the wire agree on one definition instead of two structurally
 * -identical copies drifting apart. Every field type referenced here already lives in vehicle-core
 * (VehiclePrincipal, VehicleFailure, VehicleJobStatus, ...), which is what makes it safe for these
 * shapes to live here too, alongside the rest of Vehicle Jobs' pure pieces.
 */
export interface VehicleJobSubmitOptions {
	readonly permissions?: readonly string[];
	readonly principal?: VehiclePrincipal;
	readonly idempotencyKey?: string;
	readonly expectedRevision?: string | number;
	readonly approvalCapability?: string;
	readonly correlationId?: string;
	readonly callerSessionId?: string;
	readonly callerProjectRoot?: string;
	/** Defaults to "transition". */
	readonly notifyMode?: VehicleJobNotifyMode;
	/** Defaults to background.defaultWakeBudget; clamped to background.maxWakeBudget either way. */
	readonly wakeBudget?: VehicleJobWakeBudget;
	/** No default -- unset means the job runs until it settles or is canceled. */
	readonly maxLifetimeMs?: number;
}

export interface VehicleJobSubmitResult {
	readonly jobId: string;
}

export interface VehicleJobSnapshot {
	readonly jobId: string;
	readonly operationName: string;
	readonly operationVersion: number;
	readonly status: VehicleJobStatus;
	readonly createdAt: number;
	readonly updatedAt: number;
	readonly delivered: boolean;
	readonly terminationReason?: VehicleJobTerminationReason;
	readonly output?: unknown;
	readonly error?: VehicleFailure;
}

export interface VehicleJobTailResult {
	readonly entries: readonly VehicleJobWakeEntry[];
	readonly cursor: number;
}
