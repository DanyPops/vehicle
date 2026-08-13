/**
 * Half of a pair (see separate-vehicle-b-extension.ts) proving the neutral shared meta-tools work
 * across genuinely separate extension MODULES -- the real topology every actual multi-consumer Pi
 * install (pipes, tickets, papyrus, packed, each its own npm package/settings.json entry) uses, and
 * the one thing two-vehicles-broker-extension.ts's single-file, two-calls-in-one-factory shape
 * could never exercise: two independent `export default` factories, each with its own module-level
 * state, loaded by Pi's real extension loader as two distinct extensions.
 */
import type { VehicleClient, VehicleInvocationOptions, VehicleManifest, VehicleManifestOperation } from "@danypops/vehicle-core";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerVehicleTools } from "../../src/vehicle-pi.ts";

const limits = { defaultTimeoutMs: 1_000, maxTimeoutMs: 5_000, maxRequestBytes: 1_024, maxResponseBytes: 1_024 };

function operation(name: string): VehicleManifestOperation {
	return {
		name,
		version: 1,
		description: `Run ${name}.`,
		inputSchema: { type: "object", properties: {} },
		outputSchema: { type: "object" },
		permissions: [],
		effect: "read",
		idempotency: { mode: "safe" },
		streaming: false,
		longRunning: false,
		limits,
		errors: [],
		available: true,
	};
}

class FakeClient implements VehicleClient {
	constructor(public value: VehicleManifest) {}
	manifest(): Promise<VehicleManifest> {
		return Promise.resolve(this.value);
	}
	async invoke<Output = unknown>(_name: string, _version: number, _input: unknown, _options?: VehicleInvocationOptions): Promise<Output> {
		return { ok: true } as Output;
	}
	close(): Promise<void> {
		return Promise.resolve();
	}
}

export default async function (pi: ExtensionAPI): Promise<void> {
	const manifest: VehicleManifest = {
		name: "vehicle-a",
		version: "1.0.0",
		description: "Vehicle A.",
		operations: [operation("alpha.report")],
	};
	await registerVehicleTools(pi, new FakeClient(manifest), { shell: { coreOperations: [] } });
}
