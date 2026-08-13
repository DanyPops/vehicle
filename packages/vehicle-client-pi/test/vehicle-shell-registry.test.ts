import { beforeEach, describe, expect, it } from "bun:test";
import type { VehicleClient, VehicleManifest } from "@danypops/vehicle-core";
import { __resetInProcessVehicleRegistryForTests, listInProcessVehicles, registerInProcessVehicle } from "../src/vehicle-shell-registry.ts";

// bun test runs every file in one process -- this registry is a deliberately process-wide
// globalThis singleton, so it also accumulates across files/tests unless reset first.
beforeEach(() => {
	__resetInProcessVehicleRegistryForTests();
});

function manifest(name: string): VehicleManifest {
	return { name, version: "1.0.0", description: `${name} Vehicle.`, operations: [] };
}

const fakeClient = {} as VehicleClient;
const noopActivate = () => "unused";

describe("vehicle-shell-registry", () => {
	it("lists a registered vehicle, excluding the caller's own name when one is given", () => {
		registerInProcessVehicle("alpha", manifest("alpha"), fakeClient, noopActivate);
		registerInProcessVehicle("beta", manifest("beta"), fakeClient, noopActivate);

		const seenByAlpha = listInProcessVehicles("alpha").map((v) => v.name);
		expect(seenByAlpha).toContain("beta");
		expect(seenByAlpha).not.toContain("alpha");
	});

	it("lists every registered vehicle, including its own name, when no exclusion is given -- the neutral caller's own shape", () => {
		registerInProcessVehicle("zeta", manifest("zeta"), fakeClient, noopActivate);
		const seen = listInProcessVehicles().map((v) => v.name);
		expect(seen).toContain("zeta");
	});

	it("re-registering the same name overwrites the previous entry, not duplicates it", () => {
		registerInProcessVehicle("gamma", manifest("gamma"), fakeClient, noopActivate);
		registerInProcessVehicle("gamma", manifest("gamma"), fakeClient, noopActivate);

		const seen = listInProcessVehicles("delta").filter((v) => v.name === "gamma");
		expect(seen.length).toBe(1);
	});

	it("a caller who never registered anything still sees every other registered vehicle", () => {
		registerInProcessVehicle("epsilon", manifest("epsilon"), fakeClient, noopActivate);
		const seen = listInProcessVehicles("never-registered").map((v) => v.name);
		expect(seen).toContain("epsilon");
	});

	it("carries each vehicle's own activateOperation closure through, distinct per vehicle", () => {
		const activateEta = () => "eta_tool";
		const activateTheta = () => "theta_tool";
		registerInProcessVehicle("eta", manifest("eta"), fakeClient, activateEta);
		registerInProcessVehicle("theta", manifest("theta"), fakeClient, activateTheta);

		const seen = listInProcessVehicles();
		expect(seen.find((v) => v.name === "eta")?.activateOperation).toBe(activateEta);
		expect(seen.find((v) => v.name === "theta")?.activateOperation).toBe(activateTheta);
	});
});
