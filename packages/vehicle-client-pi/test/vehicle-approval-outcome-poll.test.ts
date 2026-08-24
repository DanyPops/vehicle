/**
 * TDD: written before src/vehicle-approval-outcome-poll.ts's own behavior was locked down.
 *
 * Push half of the Approval Gate's outcome-visibility story -- see the module's own doc comment
 * for the Papyrus Discussion parallel this closes the gap with.
 */
import { describe, expect, it } from "bun:test";
import { VEHICLE_APPROVAL_STATUS_OPERATION_NAME } from "@danypops/vehicle-core";
import { MAX_TRACKED_APPROVAL_REQUESTS, VehicleApprovalOutcomePoll } from "../src/vehicle-approval-outcome-poll.ts";

function fakeNotifier() {
	const calls: Array<{ content: string; options?: { deliverAs?: "steer" | "followUp" } }> = [];
	return {
		calls,
		sendUserMessage: (content: string, options?: { deliverAs?: "steer" | "followUp" }) => calls.push({ content, options }),
	};
}

function fakeClient(statusByRequestId: Record<string, unknown>) {
	const calls: string[] = [];
	return {
		calls,
		invoke: async <Output = unknown>(name: string, _version: number, input: unknown): Promise<Output> => {
			calls.push(name);
			if (name !== VEHICLE_APPROVAL_STATUS_OPERATION_NAME) throw new Error(`unexpected operation ${name}`);
			const { requestId } = input as { requestId: string };
			const result = statusByRequestId[requestId];
			if (!result) throw new Error(`no fixture for ${requestId}`);
			return result as Output;
		},
	};
}

describe("VehicleApprovalOutcomePoll", () => {
	it("delivers nothing and keeps a still-pending request tracked", async () => {
		const client = fakeClient({ "req-1": { requestId: "req-1", status: "pending" } });
		const notifier = fakeNotifier();
		const poll = new VehicleApprovalOutcomePoll(client, notifier);
		poll.record("req-1", "stage.push");

		await poll.poll();

		expect(notifier.calls).toEqual([]);
		expect(poll.trackedCount).toBe(1);
	});

	it("delivers a granted outcome and forgets the request", async () => {
		const client = fakeClient({
			"req-1": { requestId: "req-1", status: "resolved", outcome: { decision: "granted", decidedAt: 1000, decidedBy: "alice" } },
		});
		const notifier = fakeNotifier();
		const poll = new VehicleApprovalOutcomePoll(client, notifier);
		poll.record("req-1", "stage.push");

		await poll.poll();

		expect(notifier.calls).toHaveLength(1);
		expect(notifier.calls[0]?.content).toContain("req-1");
		expect(notifier.calls[0]?.content).toContain("stage.push");
		expect(notifier.calls[0]?.content).toContain("granted");
		expect(notifier.calls[0]?.content).toContain("by alice");
		expect(notifier.calls[0]?.options).toEqual({ deliverAs: "followUp" });
		expect(poll.trackedCount).toBe(0);
	});

	it("surfaces a denial's own comment -- the exact gap this module exists to close", async () => {
		const client = fakeClient({
			"req-1": {
				requestId: "req-1",
				status: "resolved",
				outcome: { decision: "denied", decidedAt: 1000, comment: "wrong environment" },
			},
		});
		const notifier = fakeNotifier();
		const poll = new VehicleApprovalOutcomePoll(client, notifier);
		poll.record("req-1", "stage.push");

		await poll.poll();

		expect(notifier.calls[0]?.content).toContain("denied");
		expect(notifier.calls[0]?.content).toContain("Comment: wrong environment");
	});

	it("reports an unknown outcome (expired unresolved, or aged out of history) distinctly, and still forgets it", async () => {
		const client = fakeClient({ "req-1": { requestId: "req-1", status: "unknown" } });
		const notifier = fakeNotifier();
		const poll = new VehicleApprovalOutcomePoll(client, notifier);
		poll.record("req-1", "stage.push");

		await poll.poll();

		expect(notifier.calls[0]?.content).toContain("expired without ever being decided");
		expect(poll.trackedCount).toBe(0);
	});

	it("is idempotent -- recording the same requestId twice tracks it only once", () => {
		const client = fakeClient({});
		const poll = new VehicleApprovalOutcomePoll(client, fakeNotifier());
		poll.record("req-1", "stage.push");
		poll.record("req-1", "stage.push");
		expect(poll.trackedCount).toBe(1);
	});

	it("checks every tracked request independently, one status-check failure never blocking the rest", async () => {
		const client = {
			invoke: async <Output = unknown>(_name: string, _version: number, input: unknown): Promise<Output> => {
				const { requestId } = input as { requestId: string };
				if (requestId === "req-fails") throw new Error("transient");
				return { requestId, status: "resolved", outcome: { decision: "granted", decidedAt: 1000 } } as Output;
			},
		};
		const notifier = fakeNotifier();
		const poll = new VehicleApprovalOutcomePoll(client, notifier);
		poll.record("req-fails", "stage.push");
		poll.record("req-ok", "issue.create");

		await poll.poll();

		expect(notifier.calls).toHaveLength(1);
		expect(notifier.calls[0]?.content).toContain("req-ok");
		expect(poll.trackedCount).toBe(1); // req-fails stays tracked for the next poll
	});

	it("never throws when the notifier itself throws, and still forgets the now-known outcome", async () => {
		const client = fakeClient({
			"req-1": { requestId: "req-1", status: "resolved", outcome: { decision: "granted", decidedAt: 1000 } },
		});
		const notifier = {
			sendUserMessage: () => {
				throw new Error("session is mid-shutdown");
			},
		};
		const poll = new VehicleApprovalOutcomePoll(client, notifier);
		poll.record("req-1", "stage.push");

		await expect(poll.poll()).resolves.toBeUndefined();
		expect(poll.trackedCount).toBe(0);
	});

	it("ignores a malformed status response instead of throwing or delivering garbage", async () => {
		const client = fakeClient({ "req-1": { nonsense: true } });
		const notifier = fakeNotifier();
		const poll = new VehicleApprovalOutcomePoll(client, notifier);
		poll.record("req-1", "stage.push");

		await expect(poll.poll()).resolves.toBeUndefined();
		expect(notifier.calls).toEqual([]);
		expect(poll.trackedCount).toBe(1); // left tracked -- indistinguishable from a transient hiccup
	});

	it("bounds total tracked requests -- the oldest is evicted (never surfaced) to make room", () => {
		const client = fakeClient({});
		const poll = new VehicleApprovalOutcomePoll(client, fakeNotifier());
		for (let i = 0; i < MAX_TRACKED_APPROVAL_REQUESTS + 1; i++) poll.record(`req-${i}`, "stage.push");
		expect(poll.trackedCount).toBe(MAX_TRACKED_APPROVAL_REQUESTS);
	});
});
