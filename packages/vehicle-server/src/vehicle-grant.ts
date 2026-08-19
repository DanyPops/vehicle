/**
 * The Grant primitive's server-side half: a single, tiny, always-gated operation any
 * background job's own handler can invoke, mid-flight, to ask for more resource budget
 * (packages/vehicle-core's own VehicleGrantBudget) once its current allotment runs out.
 *
 * Deliberately reuses VehicleRegistry.configureApprovals()'s own real, already-tested
 * approval-gating workflow -- enforceGate(), pending-request bookkeeping, the built-in
 * vehicle.approval.resolve operation, the requested/resolved events -- rather than building a
 * second, parallel approval mechanism. This operation's own handler does nothing beyond
 * succeeding once invoke() itself has already verified a presented capability; the whole point
 * of registering it is to make the registry's own enforceGate() run again mid-job, which is not
 * otherwise possible once a job's own outer operation has already passed its one gate check at
 * submit() time (VehicleRegistry.resolveForBackground() gates once, at submission, not on every
 * later steer()).
 *
 * A job handler that wants Grant semantics closes over its own registry reference (available
 * to it because operation registration and handler binding happen in the same module scope,
 * not because VehicleOperationContext exposes the registry itself) and does:
 *
 *   try {
 *     await registry.invoke(VEHICLE_GRANT_CONTINUE_OPERATION_NAME, 1, { requestedBudget });
 *   } catch (error) {
 *     if (!isVehicleError(error) || error.code !== "approval-required") throw error;
 *     const { value } = await steerIterator.next(); // context.steerInputs -- a real await
 *     budget = mergeGrantBudget(budget, value);
 *   }
 *
 * See packages/vehicle-server/test/vehicle-grant.test.ts for this composition proven end to end
 * against a real VehicleRegistry + VehicleJobStore, not a downstream consumer's fixture.
 *
 * Deliberately NOT included here (see this task's own explicit non-goals): a generic
 * "grant-aware job loop" higher-order helper. Shipping the operation + the pattern above,
 * proven by test, is the right increment until a second real consumer's own exact shape is
 * known -- extracting a one-shape-fits-all loop from a single usage would be premature.
 */
import { bindVehicleOperation, defineVehicleOperation, defineVehicleSchema } from "@danypops/vehicle-core";
import type { VehicleRegistry } from "./vehicle-registry.js";

/** The one operation this module registers -- see this file's own doc comment for why a job asking for more budget re-invokes a distinct operation rather than re-entering its own. */
export const VEHICLE_GRANT_CONTINUE_OPERATION_NAME = "vehicle.grant.continue";

interface GrantContinueInput {
	/** Purely informational today -- carried through so a real deployment's own audit trail records what was actually asked for, even though this operation's own handler doesn't act on it (the requesting job's own steer-loop is what actually merges the budget once woken). */
	readonly requestedBudget?: Record<string, unknown>;
}

interface GrantContinueOutput {
	readonly acknowledged: true;
}

const inputSchema = defineVehicleSchema<GrantContinueInput>({
	jsonSchema: { type: "object", properties: { requestedBudget: { type: "object" } }, additionalProperties: false },
	safeParse(value) {
		if (value === undefined || value === null) return { success: true, value: {} };
		if (typeof value !== "object") return { success: false, issues: [{ path: [], message: "input must be an object" }] };
		const row = value as { requestedBudget?: unknown };
		if (row.requestedBudget !== undefined && (typeof row.requestedBudget !== "object" || row.requestedBudget === null)) {
			return { success: false, issues: [{ path: ["requestedBudget"], message: "requestedBudget must be an object" }] };
		}
		return { success: true, value: { requestedBudget: row.requestedBudget as Record<string, unknown> | undefined } };
	},
});

const outputSchema = defineVehicleSchema<GrantContinueOutput>({
	jsonSchema: { type: "object", properties: { acknowledged: { type: "boolean" } }, required: ["acknowledged"], additionalProperties: false },
	safeParse: () => ({ success: true, value: { acknowledged: true } }),
});

/**
 * Registers vehicle.grant.continue against `registry`. Call once, after `configureApprovals()`
 * so the operation's own `requiresApproval: true` actually has a policy to be gated by
 * (registering it before approvals are configured is harmless -- resolvesToApprovalRequired()
 * is false until configureApprovals() runs -- but there is then nothing to gate against until
 * that call happens).
 *
 * `requiresApproval: true` unconditionally, independent of `effect` -- asking for more
 * autonomous runway is exactly the case human-in-the-loop exists for, the same "always gated,
 * never effect-dependent" choice this ecosystem's own onboarding-tour design settled on for its
 * analogous propose_visual_cue operation.
 */
export function registerVehicleGrantOperation(registry: VehicleRegistry): void {
	const operation = defineVehicleOperation({
		name: VEHICLE_GRANT_CONTINUE_OPERATION_NAME,
		version: 1,
		description: "Requests more resource budget for an already-running, budget-exhausted long-running Vehicle job. Always requires approval.",
		input: inputSchema,
		output: outputSchema,
		permissions: [],
		effect: "read",
		requiresApproval: true,
		idempotency: { mode: "unsafe" },
		limits: { defaultTimeoutMs: 5_000, maxTimeoutMs: 5_000, maxRequestBytes: 4_096, maxResponseBytes: 1_024 },
	});
	registry.register("vehicle-grant", bindVehicleOperation(operation, () => async () => ({ acknowledged: true })));
}
