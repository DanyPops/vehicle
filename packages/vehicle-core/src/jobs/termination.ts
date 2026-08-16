export type VehicleJobStatus = "running" | "succeeded" | "failed" | "canceled";

/** Highest precedence first -- an explicit cancel always wins even if the handler also settled around the same time. "orphaned" is a restart-reconciliation outcome: a job that was still "running" when its process died, so nothing ever really failed or succeeded -- the record's own status just goes stale. */
export const VEHICLE_JOB_TERMINATION_PRECEDENCE = ["canceled", "timeout", "orphaned", "failed", "succeeded"] as const;
export type VehicleJobTerminationReason = (typeof VEHICLE_JOB_TERMINATION_PRECEDENCE)[number];

export function resolveVehicleJobTerminationReason(candidates: readonly VehicleJobTerminationReason[]): VehicleJobTerminationReason {
	if (candidates.length === 0) throw new Error("resolveVehicleJobTerminationReason requires at least one candidate");
	for (const reason of VEHICLE_JOB_TERMINATION_PRECEDENCE) {
		if (candidates.includes(reason)) return reason;
	}
	throw new Error(`Unrecognized Vehicle job termination candidate(s): ${candidates.join(", ")}`);
}
