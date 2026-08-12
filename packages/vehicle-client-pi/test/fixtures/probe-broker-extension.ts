/**
 * Registers as the tools_list/tools_man broker owner ("probe"), backed by a real RemoteVehicleClient
 * connection to a real fixture-vehicle-daemon.ts instance named "probe" (see
 * vehicle-server/test/fixtures/fixture-vehicle-daemon.ts) -- started as a companion daemon by
 * whichever test uses this extension. Broker discovery uses the real default filesystem path (no
 * discover override), so it picks up any OTHER fixture-vehicle-daemon instance (e.g. one named
 * "fixture") that publishes its handle into the same $XDG_RUNTIME_DIR -- including one that gets
 * killed and replaced by a differently-versioned instance mid-session, which is the whole point.
 */
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
