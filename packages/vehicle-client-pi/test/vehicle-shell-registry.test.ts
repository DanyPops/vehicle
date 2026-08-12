import { describe, expect, it } from "bun:test";
import type { VehicleClient, VehicleManifest } from "@danypops/vehicle-core";
import { listInProcessVehicles, registerInProcessVehicle } from "../src/vehicle-shell-registry.ts";

function manifest(name: string): VehicleManifest {
	return { name, version: "1.0.0", description: `${name} Vehicle.`, operations: [] };
}

const fakeClient = {} as VehicleClient;

describe("vehicle-shell-registry", () => {
	it("lists a registered vehicle, excluding the caller's own name", () => {
		registerInProcessVehicle("alpha", manifest("alpha"), fakeClient);
		registerInProcessVehicle("beta", manifest("beta"), fakeClient);

		const seenByAlpha = listInProcessVehicles("alpha").map((v) => v.name);
		expect(seenByAlpha).toContain("beta");
		expect(seenByAlpha).not.toContain("alpha");
	});

	it("re-registering the same name overwrites the previous entry, not duplicates it", () => {
		registerInProcessVehicle("gamma", manifest("gamma"), fakeClient);
		registerInProcessVehicle("gamma", manifest("gamma"), fakeClient);

		const seen = listInProcessVehicles("delta").filter((v) => v.name === "gamma");
		expect(seen.length).toBe(1);
	});

	it("a caller who never registered anything still sees every other registered vehicle", () => {
		registerInProcessVehicle("epsilon", manifest("epsilon"), fakeClient);
		const seen = listInProcessVehicles("never-registered").map((v) => v.name);
		expect(seen).toContain("epsilon");
	});
});
