import { expect, it } from "bun:test";
import {
	registerVehicleClientConformance,
	type VehicleConformanceFixture,
	type VehicleConformanceMatchers,
	type VehicleConformanceRunner,
} from "../src/vehicle-conformance.ts";
import { runVehicleClientConformanceWithVitest } from "../src/vitest.ts";

const fixture: VehicleConformanceFixture = {
	label: "registration fixture",
	async create() {
		throw new Error("registration-only fixture must never execute");
	},
};

function collector(names: string[]): VehicleConformanceRunner {
	return {
		describe(_name, body) {
			body();
		},
		it(name) {
			names.push(name);
		},
		expect: () => ({}) as VehicleConformanceMatchers,
	};
}

it("Vitest adapter registers the authoritative runner-neutral scenario matrix", () => {
	const coreNames: string[] = [];
	registerVehicleClientConformance(collector(coreNames), fixture);

	const vitestNames: string[] = [];
	runVehicleClientConformanceWithVitest(
		{
			describe(_name, body) {
				body();
			},
			it(name) {
				vitestNames.push(name);
			},
			expect: () => ({}),
		},
		fixture,
	);

	expect(vitestNames).toEqual(coreNames);
	expect(vitestNames.length).toBeGreaterThan(10);
});
