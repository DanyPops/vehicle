import { describe, expect, it } from "bun:test";
import type { VehicleClient, VehicleInvocationOptions, VehicleManifest } from "@danypops/vehicle-core";
import type { SharedVehicleHandleEntry } from "@danypops/vehicle-server/paths";
import { discoverForeignVehicles } from "../src/vehicle-shell-broker.ts";

function manifest(name: string): VehicleManifest {
	return { name, version: "1.0.0", description: "", operations: [] };
}

class FakeClient implements VehicleClient {
	constructor(private readonly value: VehicleManifest) {}
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
			createClient: (baseUrl, token) => {
				expect(baseUrl).toBe("http://127.0.0.1:4321");
				expect(token).toBe("secret-token");
				return new FakeClient(manifest("packed"));
			},
		});
		expect(result.map((entry) => ({ name: entry.name, manifest: entry.manifest }))).toEqual([
			{ name: "packed", manifest: manifest("packed") },
		]);
		expect(result[0]?.client).toBeInstanceOf(FakeClient);
	});

	it("excludes its own vehicle's entry -- never discovers or fetches itself", async () => {
		let fetched = false;
		const result = await discoverForeignVehicles("papyrus", {
			listHandleFiles: async () => ["papyrus.json", "packed.json"],
			readHandle: () => handle(),
			isPidAlive: () => true,
			readToken: async () => "secret-token",
			createClient: () => {
				fetched = true;
				return new FakeClient(manifest("packed"));
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
			createClient: () => new FakeClient(manifest("packed")),
		});
		expect(result).toEqual([]);
	});

	it("excludes a vehicle with no tokenPath -- discoverable as live, but not fetchable without it", async () => {
		const result = await discoverForeignVehicles("papyrus", {
			listHandleFiles: async () => ["packed.json"],
			readHandle: () => handle({ tokenPath: undefined }),
			isPidAlive: () => true,
			createClient: () => new FakeClient(manifest("packed")),
		});
		expect(result).toEqual([]);
	});

	it("excludes a vehicle whose token file is unreadable (permission denied, missing, ...)", async () => {
		const result = await discoverForeignVehicles("papyrus", {
			listHandleFiles: async () => ["packed.json"],
			readHandle: () => handle(),
			isPidAlive: () => true,
			readToken: async () => undefined,
			createClient: () => new FakeClient(manifest("packed")),
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
			createClient: (baseUrl) => {
				if (baseUrl.includes("4321")) {
					class ThrowingClient extends FakeClient {
						override manifest(): Promise<VehicleManifest> {
							return Promise.reject(new Error("connection refused"));
						}
					}
					return new ThrowingClient(manifest("packed"));
				}
				return new FakeClient(manifest("pipes"));
			},
		});
		expect(result.map((entry) => ({ name: entry.name, manifest: entry.manifest }))).toEqual([
			{ name: "pipes", manifest: manifest("pipes") },
		]);
	});

	it("ignores a non-.json entry in the shared directory", async () => {
		const result = await discoverForeignVehicles("papyrus", {
			listHandleFiles: async () => ["stray.lock"],
			createClient: () => new FakeClient(manifest("packed")),
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
			createClient: () => new FakeClient(manifest("packed")),
		});
		expect(result.length).toBe(1);
	});

	it("a discovered vehicle's own client is a real, usable VehicleClient -- reused directly for routing, never rebuilt from raw parts", async () => {
		const client = new FakeClient(manifest("packed"));
		const result = await discoverForeignVehicles("papyrus", {
			listHandleFiles: async () => ["packed.json"],
			readHandle: () => handle(),
			isPidAlive: () => true,
			readToken: async () => "secret-token",
			createClient: () => client,
		});
		expect(result[0]?.client).toBe(client);
		await expect(result[0]?.client.invoke("package.install", 1, {})).resolves.toEqual({ ok: true });
	});
});
