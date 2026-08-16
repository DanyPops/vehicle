/**
 * Process-local companion to vehicle-shell-broker.ts's filesystem-based discovery, and the single
 * source of truth vehicle-shell.ts's neutral, centrally-owned tools_list/tools_man read from.
 *
 * Earlier revisions of this file existed because several pi-* extensions each calling
 * registerVehicleTools() meant only one of them could own the literal "tools_list"/"tools_man" Pi
 * tool names, and every other extension's own attempt silently never ran -- this registry let the
 * accidental winner see everyone else's operations too. vehicle-shell.ts no longer lets any one
 * vehicle "win" ownership at all: the meta-tools are registered exactly once, by nobody's identity
 * in particular, and always read every vehicle from here. This registry is what makes that
 * possible -- every vehicle still just registers itself unconditionally; nothing else changed
 * about that half of the contract.
 *
 * Every registerVehicleTools() call publishes itself here unconditionally, regardless of whether
 * it uses shell mode at all -- registering is what makes a vehicle discoverable in-process; who
 * (if anyone) exposes a "tools_list" tool is a separate concern this registry has no opinion on.
 * Modeled on vstack's own Activity Broker pattern (a globalThis[Symbol.for(...)] cross-extension
 * registry, duck-typed, zero hard dependency between publisher and reader) -- see the Vehicle
 * roadmap research this house already did on it, and Eclipse's own Extension Point/Extension
 * Registry pattern (the platform owns the registry; a contributing plugin never does).
 */
import type { VehicleClient, VehicleManifest, VehicleManifestOperation } from "@danypops/vehicle-core";
import type { DiscoveredVehicle } from "./vehicle-shell-broker.js";

// Versioned key, matching secrets-registry.ts/vehicle-safety-registry.ts's own convention: a
// bare, unversioned key lets two genuinely different loaded code versions of this file (see
// this file's own doc comment above) silently share one slot even if InProcessRegistryEntry's
// shape ever drifts between them; "@1" means a future breaking change gets its own fresh key.
const REGISTRY_KEY = Symbol.for("vehicle.shell.in-process-registry@1");

/** A discovered in-process vehicle that can also activate one of its own operations as a real,
 * fully policy-wrapped Pi tool -- built from THAT vehicle's own RegisterVehicleToolsOptions, never
 * borrowed from whichever vehicle happens to trigger the shared meta-tools' own creation. */
export interface InProcessDiscoveredVehicle extends DiscoveredVehicle {
	readonly activateOperation: (descriptor: VehicleManifestOperation) => string;
}

interface InProcessRegistryEntry {
	readonly manifest: VehicleManifest;
	readonly client: VehicleClient;
	readonly activateOperation: (descriptor: VehicleManifestOperation) => string;
}

function registry(): Map<string, InProcessRegistryEntry> {
	const holder = globalThis as { [REGISTRY_KEY]?: Map<string, InProcessRegistryEntry> };
	if (!holder[REGISTRY_KEY]) holder[REGISTRY_KEY] = new Map();
	return holder[REGISTRY_KEY];
}

/** Best-effort: a broken globalThis (e.g. a frozen realm in some test sandbox) must never break real tool registration. */
export function registerInProcessVehicle(
	name: string,
	manifest: VehicleManifest,
	client: VehicleClient,
	activateOperation: (descriptor: VehicleManifestOperation) => string,
): void {
	try {
		registry().set(name, { manifest, client, activateOperation });
	} catch {
		// Registration failure here is never fatal -- the vehicle just stays undiscoverable in-process.
	}
}

/** Every vehicle currently registered in this process, optionally excluding one name. Synchronous
 * and free -- no IO, unlike discoverForeignVehicles. Omit `excludeVehicleName` to list everyone --
 * the shape a neutral, no-particular-vehicle's-own caller (vehicle-shell.ts's shared meta-tools)
 * needs, since it has no "own name" to exclude. */
export function listInProcessVehicles(excludeVehicleName?: string): readonly InProcessDiscoveredVehicle[] {
	try {
		return [...registry().entries()]
			.filter(([name]) => name !== excludeVehicleName)
			.map(([name, entry]) => ({ name, manifest: entry.manifest, client: entry.client, activateOperation: entry.activateOperation }));
	} catch {
		return [];
	}
}

/** Test-only: clears every registered vehicle. `bun test` runs every test file in one process, so
 * this globalThis[Symbol.for(...)] singleton -- deliberately process-wide, the whole point of it --
 * also silently accumulates across files unless a test that registers a real or fake vehicle
 * resets it first. Not exported from the package's own public entry point. */
export function __resetInProcessVehicleRegistryForTests(): void {
	const holder = globalThis as { [REGISTRY_KEY]?: Map<string, InProcessRegistryEntry> };
	delete holder[REGISTRY_KEY];
}
