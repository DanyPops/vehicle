import { describe, expect, it } from "bun:test";
import {
	registerToolShellDualChannelConformance,
	registerVehicleClientConformance,
	type ToolShellDualChannelFixture,
	type VehicleConformanceFixture,
	type VehicleConformanceMatchers,
	type VehicleConformanceRunner,
} from "./vehicle-conformance.js";

const bunRunner: VehicleConformanceRunner = {
	describe: (name, body) => describe(name, body),
	it: (name, body) => it(name, body),
	expect: (actual, message) => expect(actual, message) as unknown as VehicleConformanceMatchers,
};

/** Registers the shared Vehicle client matrix with Bun's test runner. */
export function runVehicleClientConformance(fixture: VehicleConformanceFixture): void {
	registerVehicleClientConformance(bunRunner, fixture);
}

/** Registers the shared Tool Shell matrix with Bun's test runner. */
export function runToolShellDualChannelConformance(fixture: ToolShellDualChannelFixture): void {
	registerToolShellDualChannelConformance(bunRunner, fixture);
}

export * from "./vehicle-conformance.js";
