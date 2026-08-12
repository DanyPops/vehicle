/** Broker owner ("probe"), backed by a real fixture-vehicle-daemon.ts instance named "probe".
 * Real default filesystem discovery, so it picks up any other fixture instance sharing
 * $XDG_RUNTIME_DIR -- including one killed and replaced mid-session. */
import { readFileSync } from "node:fs";
import { RemoteVehicleClient } from "@danypops/vehicle-client/http";
import { resolveSharedVehicleHandlePath } from "@danypops/vehicle-server/paths";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerVehicleTools } from "../../src/vehicle-pi.ts";

export default async function (pi: ExtensionAPI): Promise<void> {
	const handlePath = resolveSharedVehicleHandlePath("probe");
	const handle = JSON.parse(readFileSync(handlePath, "utf8")) as { host: string; port: number; tokenPath: string };
	const token = readFileSync(handle.tokenPath, "utf8").trim();
	const client = new RemoteVehicleClient({ baseUrl: `http://${handle.host}:${handle.port}`, token });
	await registerVehicleTools(pi, client, { shell: { broker: { ownVehicleName: "probe" } } });
}
