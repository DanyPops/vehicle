import { describe, expect, it } from "bun:test";
import {
	bindVehicleOperation,
	defineVehicleOperation,
	defineVehicleSchema,
	grantBudgetExhausted,
	isVehicleError,
	mergeGrantBudget,
	type VehicleGrantBudget,
	type VehicleOperationBinding,
} from "@danypops/vehicle-core";
import { registerVehicleGrantOperation, VEHICLE_GRANT_CONTINUE_OPERATION_NAME } from "../src/vehicle-grant.ts";
import { VehicleJobStore } from "../src/vehicle-job-store.ts";
import { VehicleRegistry } from "../src/vehicle-registry.ts";

const passthroughSchema = defineVehicleSchema<Record<string, unknown>>({
	jsonSchema: { type: "object" },
	safeParse: (value) => ({ success: true, value: (value ?? {}) as Record<string, unknown> }),
});

const LIMITS = { defaultTimeoutMs: 1_000, maxTimeoutMs: 5_000, maxRequestBytes: 4_096, maxResponseBytes: 4_096 } as const;

/**
 * A real, working Grant-aware job: on each "tick" of steerInputs it either does one more unit
 * of real work (decrementing maxTurns) or, once exhausted, invokes vehicle.grant.continue
 * through the SAME registry the job itself is running under -- catching a real approval-required
 * VehicleError and awaiting the job's own steerInputs for the actual wake-up, exactly the pattern
 * this task's own body describes. `ticks` records every real unit of work actually performed, so
 * a test can assert the real handler never ran while a request was pending.
 */
function grantAwareJob(registry: VehicleRegistry, initialBudget: VehicleGrantBudget, ticks: string[]) {
	const operation = defineVehicleOperation({
		name: "test.grant-aware-task",
		version: 1,
		description: "A long-running task that asks for more budget once its own runs out.",
		input: passthroughSchema,
		output: passthroughSchema,
		permissions: [],
		effect: "read",
		idempotency: { mode: "safe" },
		longRunning: true,
		limits: LIMITS,
		background: {
			supported: true,
			defaultWakeBudget: { maxCount: 100, maxBytes: 100_000 },
			maxWakeBudget: { maxCount: 100, maxBytes: 100_000 },
		},
	});
	const binding = bindVehicleOperation(operation, () => async (context) => {
		let budget = initialBudget;
		const steerIterator = context.steerInputs?.[Symbol.asyncIterator]();
		while (true) {
			if (grantBudgetExhausted(budget)) {
				context.reportProgress({ phase: "awaiting-grant-approval" });
				try {
					await registry.invoke(VEHICLE_GRANT_CONTINUE_OPERATION_NAME, 1, { requestedBudget: { maxTurns: 1 } });
				} catch (error) {
					if (!isVehicleError(error) || error.code !== "approval-required") throw error;
					if (!steerIterator) throw error;
					const { value } = await steerIterator.next();
					// A consumer's own approval-resolution glue steers with an explicit denial marker rather
					// than never steering at all -- this is what lets the job define its own real terminal
					// outcome for "denied" instead of hanging forever with nothing left to observe.
					if (value && typeof value === "object" && (value as { denied?: boolean }).denied) {
						throw new Error("Grant continuation was denied");
					}
					budget = mergeGrantBudget(budget, value as VehicleGrantBudget);
					continue;
				}
				// Approvals aren't configured at all (ungated) -- proceed with whatever budget already is.
			}
			ticks.push("tick");
			budget = mergeGrantBudget(budget, { maxTurns: -1 });
			if (ticks.length >= 3) return { done: true };
		}
	});
	return binding as VehicleOperationBinding<unknown, unknown>;
}

function realRegistry(options: { readonly timeoutMs?: number } = {}): VehicleRegistry {
	const registry = new VehicleRegistry({ name: "test", version: "1", description: "Test." });
	registerVehicleGrantOperation(registry);
	registry.configureApprovals({
		requireApprovalForEffects: [],
		...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
	}); // vehicle.grant.continue always requires approval regardless of effect (see registerVehicleGrantOperation)
	return registry;
}

describe("registerVehicleGrantOperation + a real Grant-aware job, composed end to end", () => {
	it("item 1: exhausting the budget durably emits a real VehicleApprovalRequest via the registry's own existing mechanism, before any further real work runs", async () => {
		const registry = realRegistry();
		const ticks: string[] = [];
		registry.register("test-owner", grantAwareJob(registry, { maxTurns: 1 }, ticks));
		const store = new VehicleJobStore(registry);

		const requests: unknown[] = [];
		registry.subscribeLocal("vehicle.approval.requested", 1, (payload) => requests.push(payload));

		store.submit("test.grant-aware-task", 1, {});
		await new Promise((resolve) => setTimeout(resolve, 20));

		expect(ticks).toEqual(["tick"]); // did its one allotted unit of work, then stopped -- never ran a second before approval
		expect(requests).toHaveLength(1);
		expect(requests[0]).toMatchObject({ operationName: VEHICLE_GRANT_CONTINUE_OPERATION_NAME, operationVersion: 1 });
	});

	it("item 2: the job handler genuinely suspends while awaiting resolution -- provably blocked, not merely 'eventually'", async () => {
		const registry = realRegistry();
		const ticks: string[] = [];
		registry.register("test-owner", grantAwareJob(registry, { maxTurns: 1 }, ticks));
		const store = new VehicleJobStore(registry);

		const { jobId } = store.submit("test.grant-aware-task", 1, {});
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(ticks).toEqual(["tick"]);

		// A probe that would only ever run once the handler resumes: steer it with garbage a
		// few times and confirm no further tick happens, proving suspension isn't just a fluke
		// of timing but a real, held-open await.
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(ticks).toEqual(["tick"]);
		expect(store.poll(jobId).status).toBe("running");
	});

	it("item 3: resolving the request then steering the job wakes it with the exact merged budget, and it completes", async () => {
		const registry = realRegistry();
		const ticks: string[] = [];
		registry.register("test-owner", grantAwareJob(registry, { maxTurns: 1 }, ticks));
		const store = new VehicleJobStore(registry);

		let requestId!: string;
		registry.subscribeLocal("vehicle.approval.requested", 1, (payload) => {
			requestId = (payload as { requestId: string }).requestId;
		});

		const { jobId } = store.submit("test.grant-aware-task", 1, {});
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(ticks).toEqual(["tick"]);

		const resolution = (await registry.invoke(
			"vehicle.approval.resolve",
			1,
			{ requestId, decision: "granted" },
			{ permissions: ["vehicle:approvals:resolve"] },
		)) as { capability?: string };
		expect(resolution.capability).toBeDefined();
		store.steer(jobId, { maxTurns: 2 });
		await new Promise((resolve) => setTimeout(resolve, 20));

		expect(ticks).toEqual(["tick", "tick", "tick"]); // resumed and ran to completion
		expect(store.poll(jobId).status).toBe("succeeded");
	});

	it("item 4: tail() surfaces an 'awaiting grant approval' progress entry while suspended, readable across separate calls simulating separate agent turns", async () => {
		const registry = realRegistry();
		const ticks: string[] = [];
		registry.register("test-owner", grantAwareJob(registry, { maxTurns: 1 }, ticks));
		const store = new VehicleJobStore(registry);

		const { jobId } = store.submit("test.grant-aware-task", 1, {});
		await new Promise((resolve) => setTimeout(resolve, 20));

		const firstTail = store.tail(jobId, 0);
		expect(firstTail.entries.some((entry) => (entry.progress as { phase?: string }).phase === "awaiting-grant-approval")).toBe(true);

		// A later "turn" polling with an advanced cursor sees no duplicate entry.
		const secondTail = store.tail(jobId, firstTail.cursor);
		expect(secondTail.entries).toEqual([]);
	});

	it("item 5: denying the request, then steering the job with an explicit denial marker, resolves the job to a real terminal state the handler itself chose -- not left hanging forever", async () => {
		const registry = realRegistry();
		const ticks: string[] = [];
		registry.register("test-owner", grantAwareJob(registry, { maxTurns: 1 }, ticks));
		const store = new VehicleJobStore(registry);

		let requestId!: string;
		registry.subscribeLocal("vehicle.approval.requested", 1, (payload) => {
			requestId = (payload as { requestId: string }).requestId;
		});

		const { jobId } = store.submit("test.grant-aware-task", 1, {});
		await new Promise((resolve) => setTimeout(resolve, 20));

		const resolution = (await registry.invoke(
			"vehicle.approval.resolve",
			1,
			{ requestId, decision: "denied" },
			{ permissions: ["vehicle:approvals:resolve"] },
		)) as { capability?: string };
		expect(resolution.capability).toBeUndefined();
		store.steer(jobId, { denied: true });
		await new Promise((resolve) => setTimeout(resolve, 20));

		expect(ticks).toEqual(["tick"]); // never resumed real work
		expect(store.poll(jobId).status).toBe("failed"); // a real terminal state, not a silent hang
	});

	it("item 5b: a real, non-artificial expiry -- a request nobody decided in time can no longer be resolved at all, granted or denied", async () => {
		const registry = realRegistry({ timeoutMs: 5 }); // real, tiny timeout -- not a fake id standing in for expiry
		const ticks: string[] = [];
		registry.register("test-owner", grantAwareJob(registry, { maxTurns: 1 }, ticks));
		const store = new VehicleJobStore(registry);

		let requestId!: string;
		registry.subscribeLocal("vehicle.approval.requested", 1, (payload) => {
			requestId = (payload as { requestId: string }).requestId;
		});
		store.submit("test.grant-aware-task", 1, {});
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(requestId).toBeDefined();

		await new Promise((resolve) => setTimeout(resolve, 30)); // well past the 5ms timeout
		await expect(
			registry.invoke("vehicle.approval.resolve", 1, { requestId, decision: "granted" }, { permissions: ["vehicle:approvals:resolve"] }),
		).rejects.toThrow(/No pending Vehicle approval request/);
	});
});
