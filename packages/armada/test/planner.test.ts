import { describe, expect, it } from "bun:test";
import { type ManifestHash, type NativeServiceState, planFleet, systemdStrategy } from "../src/index.js";
import { manifest, vehicle } from "./fixtures.js";

function specHashOf(spec: ReturnType<typeof vehicle>): ManifestHash {
	const outcome = systemdStrategy.generateDescriptor(spec);
	if (!outcome.ok) throw new Error("fixture vehicle must be systemd-compatible");
	return outcome.descriptor.specHash;
}

describe("planFleet", () => {
	it("plans stable install operations in Vehicle-name order", () => {
		const desired = manifest([vehicle({ name: "papyrus" }), vehicle({ name: "lector" })]);
		const first = planFleet(desired, [], systemdStrategy);
		const second = planFleet(desired, [], systemdStrategy);
		expect(first).toEqual(second);
		expect(first.ok).toBe(true);
		if (!first.ok) return;
		expect(first.plan.operations.map((operation) => `${operation.kind}:${operation.name}`)).toEqual(["install:lector", "install:papyrus"]);
		expect(first.plan.planHash).toMatch(/^[a-f0-9]{64}$/);
	});

	it("produces an empty plan when native state has the desired spec hash", () => {
		const spec = vehicle();
		const actual: NativeServiceState = { name: spec.name, status: "running", specHash: specHashOf(spec), pid: 42 };
		const outcome = planFleet(manifest([spec]), [actual], systemdStrategy);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(outcome.plan.operations).toEqual([]);
	});

	it("plans update, start, and restart from actual state", () => {
		const specs = [vehicle({ name: "update" }), vehicle({ name: "start" }), vehicle({ name: "restart" })];
		const actual: NativeServiceState[] = [
			{ name: specs[0]!.name, status: "running", specHash: "stale" },
			{ name: specs[1]!.name, status: "stopped", specHash: specHashOf(specs[1]!) },
			{ name: specs[2]!.name, status: "failed", specHash: specHashOf(specs[2]!) },
		];
		const outcome = planFleet(manifest(specs), actual, systemdStrategy);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(outcome.plan.operations.map((operation) => `${operation.kind}:${operation.name}`)).toEqual([
			"restart:restart",
			"start:start",
			"update:update",
		]);
	});

	it("plans an update when contentSignature drifts even though version did not", () => {
		// The gap this closes: a package's declared version can stay constant while its real
		// installed bytes change (a local rebuild, an unpublished re-materialization). specHash
		// must react to that even when `version` alone would not.
		const before = vehicle({ contentSignature: "a".repeat(64) });
		const after = vehicle({ contentSignature: "b".repeat(64) });
		const actual: NativeServiceState = { name: before.name, status: "running", specHash: specHashOf(before) };
		const outcome = planFleet(manifest([after]), [actual], systemdStrategy);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(outcome.plan.operations).toEqual([{ kind: "update", name: after.name, specHash: specHashOf(after) }]);
	});

	it("produces an empty plan when only contentSignature is unset on both sides", () => {
		const spec = vehicle();
		const actual: NativeServiceState = { name: spec.name, status: "running", specHash: specHashOf(spec) };
		const outcome = planFleet(manifest([spec]), [actual], systemdStrategy);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(outcome.plan.operations).toEqual([]);
	});

	it("rejects duplicate and unbounded actual state", () => {
		const spec = vehicle();
		expect(
			planFleet(
				manifest([spec]),
				[
					{ name: spec.name, status: "running" },
					{ name: spec.name, status: "stopped" },
				],
				systemdStrategy,
			).ok,
		).toBe(false);
		expect(
			planFleet(
				manifest([spec]),
				Array.from({ length: 101 }, () => ({ name: spec.name, status: "running" as const })),
				systemdStrategy,
			).ok,
		).toBe(false);
	});
});
