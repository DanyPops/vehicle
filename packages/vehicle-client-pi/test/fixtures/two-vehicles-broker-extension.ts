/**
 * Reproduces the "does the broker-discovery-merge fix actually work through a real spawned `pi`
 * binary" question end-to-end: registers two Vehicles in ONE real extension-activation pass --
 * "papyrus" first (no shell of its own, exactly like a real extension that lost the
 * tools_list/tools_man ownership race), then "pipes" second (wins tools_list/tools_man ownership,
 * broker mode, no discover override -- the real default path). If the in-process registry stacking
 * fix (vehicle-shell-registry.ts) is wired correctly all the way through a real pi process's own
 * extension loader/module resolution, tools_list's real tool_execution_end result must contain
 * both vehicles' operations, namespaced. XDG_RUNTIME_DIR is left to whatever the spawning test
 * sets (isolated to an empty dir) so only the in-process registry -- not real machine daemons --
 * is exercised.
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

function manifest(name: string, operations: readonly VehicleManifestOperation[]): VehicleManifest {
	return { name, version: "1.0.0", description: `${name} Vehicle.`, operations };
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
	await registerVehicleTools(pi, new FakeClient(manifest("papyrus", [operation("tasks.create"), operation("docs.create")])), {});
	await registerVehicleTools(pi, new FakeClient(manifest("pipes", [operation("ci.status")])), {
		shell: { broker: { ownVehicleName: "pipes" } },
	});
}
