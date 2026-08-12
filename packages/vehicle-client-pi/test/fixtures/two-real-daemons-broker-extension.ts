/**
 * Same shape as two-vehicles-broker-extension.ts, but with FakeClient/synthetic manifests
 * replaced by real RemoteVehicleClient HTTP connections to two genuinely separate, already-running
 * Vehicle daemons (a real @danypops/papyrus and a real @danypops/pipes serve process -- see
 * vehicle-pi-real-daemons.test.ts, which spawns both as companion daemons before this extension
 * activates). Exercises the real HTTP manifest fetch and the real filesystem handle-file discovery
 * path (discoverForeignVehicles reading $XDG_RUNTIME_DIR/vehicle/handles/*.json), not a synthetic
 * FakeClient/in-memory manifest -- the two things two-vehicles-broker-extension.ts's own in-process
 * FakeClient registration can't exercise.
 *
 * "papyrus" registers first, no shell of its own (loses/never enters the tools_list/tools_man
 * ownership race). "pipes" registers second, wins ownership, broker mode, no discover override --
 * the real default path any real pi-pipes install actually takes.
 */
import { resolveVehicleClientTarget as resolvePapyrusVehicleClientTarget } from "@danypops/papyrus";
import { resolveVehicleClientTarget as resolvePipesVehicleClientTarget } from "@danypops/pipes";
import { RemoteVehicleClient } from "@danypops/vehicle-client/http";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerVehicleTools } from "../../src/vehicle-pi.ts";

function connectOrThrow(name: string, target: { baseUrl: string; token: string } | undefined): RemoteVehicleClient {
	if (!target)
		throw new Error(`${name} daemon handle not found -- companion daemon must be started and ready before this extension activates`);
	return new RemoteVehicleClient({ baseUrl: target.baseUrl, token: target.token });
}

export default async function (pi: ExtensionAPI): Promise<void> {
	const papyrusClient = connectOrThrow("papyrus", resolvePapyrusVehicleClientTarget());
	await registerVehicleTools(pi, papyrusClient, {});

	const pipesClient = connectOrThrow("pipes", resolvePipesVehicleClientTarget());
	await registerVehicleTools(pi, pipesClient, {
		shell: { broker: { ownVehicleName: "pipes" } },
	});
}
