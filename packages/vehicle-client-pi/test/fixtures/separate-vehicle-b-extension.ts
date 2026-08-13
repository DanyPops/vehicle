/** Other half of the pair -- see separate-vehicle-a-extension.ts's own doc comment. */
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
		name: "vehicle-b",
		version: "1.0.0",
		description: "Vehicle B.",
		operations: [operation("beta.report")],
	};
	await registerVehicleTools(pi, new FakeClient(manifest), { shell: { coreOperations: [] } });
}
