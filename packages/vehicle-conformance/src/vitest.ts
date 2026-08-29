import {
	registerToolShellDualChannelConformance,
	registerVehicleClientConformance,
	type ToolShellDualChannelFixture,
	type VehicleConformanceFixture,
	type VehicleConformanceMatchers,
	type VehicleConformanceRunner,
} from "./vehicle-conformance.js";

export interface VitestConformanceApi {
	describe(name: string, body: () => void): unknown;
	it(name: string, body: () => void | Promise<void>): unknown;
	expect(actual: unknown, message?: string): unknown;
}

function runner(api: VitestConformanceApi): VehicleConformanceRunner {
	return {
		describe: (name, body) => api.describe(name, body),
		it: (name, body) => api.it(name, body),
		expect: (actual, message) => api.expect(actual, message) as VehicleConformanceMatchers,
	};
}

/** Registers the shared Vehicle client matrix through a Vitest-compatible API. */
export function runVehicleClientConformanceWithVitest(api: VitestConformanceApi, fixture: VehicleConformanceFixture): void {
	registerVehicleClientConformance(runner(api), fixture);
}

/** Registers the shared Tool Shell matrix through a Vitest-compatible API. */
export function runToolShellDualChannelConformanceWithVitest(api: VitestConformanceApi, fixture: ToolShellDualChannelFixture): void {
	registerToolShellDualChannelConformance(runner(api), fixture);
}

export * from "./vehicle-conformance.js";
