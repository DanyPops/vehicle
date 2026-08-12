/**
 * Process-local companion to vehicle-shell-broker.ts's filesystem-based discovery. Several
 * pi-* extensions each call registerVehicleTools() inside the SAME Pi process; only one of them
 * can own the literal "tools_list"/"tools_man" Pi tool names (Pi's own first-registration-wins
 * rule), so every other extension's own Vehicle Shell/broker silently never runs (see
 * vehicle-pi.ts's "skips registering redundant meta-tools" behavior). Without this registry, the
 * one extension that DOES win ownership can only see other vehicles via a filesystem scan of the
 * shared Vehicle Handle Directory -- correct, but strictly slower and IO-dependent for something
 * that is, in this case, already sitting in the same process's memory.
 *
 * Every registerVehicleTools() call publishes itself here unconditionally, regardless of whether
 * it wins tools_list/tools_man ownership or passes any shell/broker option at all -- registering
 * is what makes a vehicle discoverable in-process; owning the meta-tools is a separate concern
 * this registry has no opinion on. Modeled on vstack's own Activity Broker pattern (a
 * globalThis[Symbol.for(...)] cross-extension registry, duck-typed, zero hard dependency between
 * publisher and reader) -- see the Vehicle roadmap research this house already did on it.
 */
import type { VehicleClient, VehicleManifest } from "@danypops/vehicle-core";
import type { DiscoveredVehicle } from "./vehicle-shell-broker.js";

const REGISTRY_KEY = Symbol.for("vehicle.shell.in-process-registry");

interface InProcessRegistryEntry {
	readonly manifest: VehicleManifest;
	readonly client: VehicleClient;
}

function registry(): Map<string, InProcessRegistryEntry> {
	const holder = globalThis as { [REGISTRY_KEY]?: Map<string, InProcessRegistryEntry> };
	if (!holder[REGISTRY_KEY]) holder[REGISTRY_KEY] = new Map();
	return holder[REGISTRY_KEY];
}

/** Best-effort: a broken globalThis (e.g. a frozen realm in some test sandbox) must never break real tool registration. */
export function registerInProcessVehicle(name: string, manifest: VehicleManifest, client: VehicleClient): void {
	try {
		registry().set(name, { manifest, client });
	} catch {
		// Registration failure here is never fatal -- the vehicle just stays undiscoverable in-process.
	}
}

/** Every OTHER vehicle currently registered in this process, excluding `ownVehicleName`. Synchronous and free -- no IO, unlike discoverForeignVehicles. */
export function listInProcessVehicles(ownVehicleName: string): readonly DiscoveredVehicle[] {
	try {
		return [...registry().entries()]
			.filter(([name]) => name !== ownVehicleName)
			.map(([name, entry]) => ({ name, manifest: entry.manifest, client: entry.client }));
	} catch {
		return [];
	}
}
