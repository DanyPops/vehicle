import type { VehicleClient, VehicleInvocationOptions, VehicleOperationDescriptor } from "@danypops/vehicle-core";
import { VehicleError } from "@danypops/vehicle-core";
import { sleep } from "./vehicle-pi-primitives.js";

/**
 * Vehicle Jobs dispatch/polling, split out of vehicle-pi.ts's own kitchen-sink module.
 *
 * Runs a background-capable operation (descriptor.background.supported) to completion via Vehicle
 * Jobs -- submitJob once, then tailJob/pollJob in a loop until it settles -- instead of one
 * live client.invoke() held open for the operation's whole duration. Deliberately internal-polling,
 * not a separate submit/poll/cancel tool surface exposed to the model: invokeVehicleOperation's own
 * caller (createTool's execute()) sees no difference in shape from a plain invoke() call -- same
 * onProgress callback semantics (one call per new tail entry), same thrown-VehicleError-on-failure
 * contract, same final output. This is the recommended default from this feature's own design
 * doc: an operation moving onto Jobs should be invisible to the model, not surface new tool calls
 * it has to learn to sequence itself.
 *
 * Falls back to a plain client.invoke() (via invokeOrRunAsJob, this function's own caller) whenever
 * the operation isn't background-capable, or the client doesn't expose submitJob at all -- so a
 * client that never wired up Vehicle Jobs (an older daemon, a minimal test double) degrades to
 * exactly today's behavior, not a hard failure.
 */
export const DEFAULT_JOB_POLL_INTERVAL_MS = 500;

async function runVehicleJobToCompletion(
	client: VehicleClient,
	descriptor: VehicleOperationDescriptor,
	input: unknown,
	invocation: VehicleInvocationOptions,
	pollIntervalMs: number,
): Promise<unknown> {
	const { jobId } = await client.submitJob!(descriptor.name, descriptor.version, input, {
		permissions: invocation.permissions,
		principal: invocation.principal,
		idempotencyKey: invocation.idempotencyKey,
		expectedRevision: invocation.expectedRevision,
		approvalCapability: invocation.approvalCapability,
		correlationId: invocation.correlationId,
		callerSessionId: invocation.callerSessionId,
		callerProjectRoot: invocation.callerProjectRoot,
	});

	// The caller's own signal (deadline, an explicit cancel) still has to actually stop the job
	// server-side -- Jobs run with no deadline of their own (see VehicleJobStore.submit's own doc
	// comment), so nothing else would ever cancel it just because this loop stops polling.
	const onAbort = (): void => void client.cancelJob?.(jobId);
	invocation.signal?.addEventListener("abort", onAbort, { once: true });

	try {
		let cursor = 0;
		for (;;) {
			if (client.tailJob) {
				const tail = await client.tailJob(jobId, cursor);
				for (const entry of tail.entries) invocation.onProgress?.(entry.progress);
				cursor = tail.cursor;
			}

			const snapshot = await client.pollJob!(jobId);
			if (snapshot.status === "succeeded") return snapshot.output;
			if (snapshot.status === "running") {
				await sleep(pollIntervalMs);
				continue;
			}

			// failed or canceled -- reconstruct the exact VehicleError a live invoke() would have
			// thrown, so every existing catch site downstream (sanitizedFailure, the approval-retry
			// dance) keeps working completely unchanged.
			const failure =
				snapshot.error ??
				(snapshot.status === "canceled"
					? { code: "job-canceled", category: "cancelled" as const, message: `Job ${jobId} was canceled`, retryable: false }
					: { code: "job-failed", category: "internal" as const, message: `Job ${jobId} failed with no further detail`, retryable: false });
			throw new VehicleError(failure.code, failure.message, {
				category: failure.category,
				retryable: failure.retryable,
				retryAfterMs: failure.retryAfterMs,
				details: failure.details,
				operationId: failure.operationId,
			});
		}
	} finally {
		invocation.signal?.removeEventListener("abort", onAbort);
	}
}

/** Dispatches to a Vehicle Job when both the operation and the client support it, otherwise a plain live invoke() -- the one seam every call site in invokeVehicleOperation goes through instead of calling client.invoke() directly. */
export function invokeOrRunAsJob(
	client: VehicleClient,
	descriptor: VehicleOperationDescriptor,
	input: unknown,
	invocation: VehicleInvocationOptions,
	pollIntervalMs: number,
): Promise<unknown> {
	if (descriptor.background?.supported && client.submitJob && client.pollJob) {
		return runVehicleJobToCompletion(client, descriptor, input, invocation, pollIntervalMs);
	}
	return client.invoke(descriptor.name, descriptor.version, input, invocation);
}
