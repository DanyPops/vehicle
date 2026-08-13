/**
 * Cross-daemon discovery for Vehicle Shell's broker mode: scans the shared Vehicle Handle
 * Directory (@danypops/vehicle-server's resolveSharedVehicleHandleDirectory/readDaemonHandle),
 * liveness-checks each entry's pid, and fetches every live foreign vehicle's own manifest --
 * the seam vehicle-shell.ts's tools_list/tools_man read from to aggregate operations across
 * every Vehicle daemon currently running on this host, not just this consumer's own.
 *
 * Every step degrades silently rather than failing the whole discovery: a stale/dead handle, a
 * missing tokenPath, an unreachable daemon, or a malformed handle file each just excludes that
 * one vehicle -- discovery never requires this consumer's own daemon to be up, and a single bad
 * entry never prevents seeing every other live one.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { RemoteVehicleClient } from "@danypops/vehicle-client/http";
import type { VehicleClient, VehicleManifest } from "@danypops/vehicle-core";
import { readDaemonHandle, resolveSharedVehicleHandleDirectory, type SharedVehicleHandleEntry } from "@danypops/vehicle-server/paths";

export interface DiscoveredVehicle {
	readonly name: string;
	readonly manifest: VehicleManifest;
	/** A real, ready-to-invoke client for this vehicle -- freshly built each discovery pass (host:port/token
	 * can change across daemon restarts), reused directly for foreign-operation routing rather than every
	 * caller rebuilding its own from raw host/port/token. */
	readonly client: VehicleClient;
}

export interface VehicleBrokerDependencies {
	/** Defaults to resolveSharedVehicleHandleDirectory(). */
	handleDirectory?: string;
	/** Lists the shared directory's own entry filenames. Defaults to a real readdir; returns [] when the directory doesn't exist yet (no Vehicle has ever registered). */
	listHandleFiles?: (directory: string) => Promise<readonly string[]>;
	/** Reads and shape-validates one handle file. Defaults to vehicle-server's own readDaemonHandle. */
	readHandle?: (path: string) => SharedVehicleHandleEntry | null;
	/** Defaults to a real process.kill(pid, 0) liveness check. */
	isPidAlive?: (pid: number) => boolean;
	/** Reads a token file's trimmed content. Defaults to a real fs read; undefined on any failure (missing, unreadable, a different OS user without permission -- never throws). */
	readToken?: (tokenPath: string) => Promise<string | undefined>;
	/** Builds a client for a live foreign vehicle. Defaults to a real RemoteVehicleClient. */
	createClient?: (baseUrl: string, token: string) => VehicleClient;
}

function defaultIsPidAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return (error as NodeJS.ErrnoException).code === "EPERM";
	}
}

async function defaultListHandleFiles(directory: string): Promise<readonly string[]> {
	try {
		const entries = await readdir(directory, { withFileTypes: true });
		return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => entry.name);
	} catch {
		return [];
	}
}

async function defaultReadToken(tokenPath: string): Promise<string | undefined> {
	try {
		return (await readFile(tokenPath, "utf8")).trim();
	} catch {
		return undefined;
	}
}

function defaultCreateClient(baseUrl: string, token: string): VehicleClient {
	return new RemoteVehicleClient({ baseUrl, token });
}

/**
 * Every live Vehicle daemon currently discoverable, optionally excluding `ownVehicleName` (a
 * consumer's own vehicle -- its operations are already known some other way, never duplicated
 * here). Omit `ownVehicleName` to list everyone, the shape a neutral caller with no "own name" of
 * its own needs. Bounded by whatever the shared directory actually contains; no network fan-out
 * timeout of its own beyond each RemoteVehicleClient call's own default.
 */
export async function discoverForeignVehicles(
	ownVehicleName?: string,
	deps: VehicleBrokerDependencies = {},
): Promise<readonly DiscoveredVehicle[]> {
	const directory = deps.handleDirectory ?? resolveSharedVehicleHandleDirectory();
	const listHandleFiles = deps.listHandleFiles ?? defaultListHandleFiles;
	const readHandle = deps.readHandle ?? readDaemonHandle;
	const isPidAlive = deps.isPidAlive ?? defaultIsPidAlive;
	const readToken = deps.readToken ?? defaultReadToken;
	const createClient = deps.createClient ?? defaultCreateClient;

	const filenames = await listHandleFiles(directory);
	const discovered = await Promise.all(
		filenames.map(async (filename): Promise<DiscoveredVehicle | undefined> => {
			if (!filename.endsWith(".json")) return undefined;
			const name = filename.slice(0, -".json".length);
			if (name === ownVehicleName) return undefined;
			try {
				const handle = readHandle(join(directory, filename));
				if (!handle || !isPidAlive(handle.pid)) return undefined;
				if (!handle.tokenPath) return undefined;
				const token = await readToken(handle.tokenPath);
				if (!token) return undefined;
				const client = createClient(`http://${handle.host}:${handle.port}`, token);
				const manifest = await client.manifest();
				return { name, manifest, client };
			} catch {
				return undefined;
			}
		}),
	);
	return discovered.filter((entry): entry is DiscoveredVehicle => entry !== undefined);
}
