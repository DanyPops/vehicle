import { describe, expect, it } from "bun:test";
import type { VehicleManifest } from "@danypops/vehicle-core";
import type { SharedVehicleHandleEntry } from "@danypops/vehicle-server/paths";
import { discoverForeignVehicles } from "../src/vehicle-shell-broker.ts";

function manifest(name: string): VehicleManifest {
	return { name, version: "1.0.0", description: "", operations: [] };
}

function handle(overrides: Partial<SharedVehicleHandleEntry> = {}): SharedVehicleHandleEntry {
	return { host: "127.0.0.1", port: 4321, pid: 999, tokenPath: "/run/u/acme/auth-token", ...overrides };
}

describe("discoverForeignVehicles", () => {
	it("returns nothing when the shared directory has no entries", async () => {
		const result = await discoverForeignVehicles("papyrus", { listHandleFiles: async () => [] });
		expect(result).toEqual([]);
	});

	it("discovers one live foreign vehicle and fetches its manifest", async () => {
		const result = await discoverForeignVehicles("papyrus", {
			listHandleFiles: async () => ["packed.json"],
			readHandle: () => handle(),
			isPidAlive: () => true,
			readToken: async () => "secret-token",
			fetchManifest: async (baseUrl, token) => {
				expect(baseUrl).toBe("http://127.0.0.1:4321");
				expect(token).toBe("secret-token");
				return manifest("packed");
			},
		});
		expect(result).toEqual([{ name: "packed", manifest: manifest("packed") }]);
	});

	it("excludes its own vehicle's entry -- never discovers or fetches itself", async () => {
		let fetched = false;
		const result = await discoverForeignVehicles("papyrus", {
			listHandleFiles: async () => ["papyrus.json", "packed.json"],
			readHandle: () => handle(),
			isPidAlive: () => true,
			readToken: async () => "secret-token",
			fetchManifest: async () => {
				fetched = true;
				return manifest("packed");
			},
		});
		expect(result.map((entry) => entry.name)).toEqual(["packed"]);
		expect(fetched).toBe(true);
	});

	it("excludes a vehicle whose handle names a dead pid", async () => {
		const result = await discoverForeignVehicles("papyrus", {
			listHandleFiles: async () => ["packed.json"],
			readHandle: () => handle(),
			isPidAlive: () => false,
			fetchManifest: async () => manifest("packed"),
		});
		expect(result).toEqual([]);
	});

	it("excludes a vehicle with no tokenPath -- discoverable as live, but not fetchable without it", async () => {
		const result = await discoverForeignVehicles("papyrus", {
			listHandleFiles: async () => ["packed.json"],
			readHandle: () => handle({ tokenPath: undefined }),
			isPidAlive: () => true,
			fetchManifest: async () => manifest("packed"),
		});
		expect(result).toEqual([]);
	});

	it("excludes a vehicle whose token file is unreadable (permission denied, missing, ...)", async () => {
		const result = await discoverForeignVehicles("papyrus", {
			listHandleFiles: async () => ["packed.json"],
			readHandle: () => handle(),
			isPidAlive: () => true,
			readToken: async () => undefined,
			fetchManifest: async () => manifest("packed"),
		});
		expect(result).toEqual([]);
	});

	it("excludes a malformed/unreadable handle file", async () => {
		const result = await discoverForeignVehicles("papyrus", {
			listHandleFiles: async () => ["packed.json"],
			readHandle: () => null,
		});
		expect(result).toEqual([]);
	});

	it("one unreachable vehicle (manifest fetch throws) never prevents discovering every other live one", async () => {
		const result = await discoverForeignVehicles("papyrus", {
			listHandleFiles: async () => ["packed.json", "pipes.json"],
			readHandle: (path) => handle({ port: path.includes("packed") ? 4321 : 5555 }),
			isPidAlive: () => true,
			readToken: async () => "secret-token",
			fetchManifest: async (baseUrl) => {
				if (baseUrl.includes("4321")) throw new Error("connection refused");
				return manifest("pipes");
			},
		});
		expect(result).toEqual([{ name: "pipes", manifest: manifest("pipes") }]);
	});

	it("ignores a non-.json entry in the shared directory", async () => {
		const result = await discoverForeignVehicles("papyrus", {
			listHandleFiles: async () => ["stray.lock"],
			fetchManifest: async () => manifest("packed"),
		});
		expect(result).toEqual([]);
	});

	it("never requires this consumer's own daemon to be up -- discovery depends only on the injected deps, no local client at all", async () => {
		// No local Vehicle client is constructed or referenced anywhere in discoverForeignVehicles'
		// own signature -- this test documents that contract rather than asserting on internals.
		const result = await discoverForeignVehicles("papyrus", {
			listHandleFiles: async () => ["packed.json"],
			readHandle: () => handle(),
			isPidAlive: () => true,
			readToken: async () => "secret-token",
			fetchManifest: async () => manifest("packed"),
		});
		expect(result.length).toBe(1);
	});
});
