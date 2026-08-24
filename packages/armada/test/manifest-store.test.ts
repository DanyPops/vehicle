import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { removeManifestVehicle, upsertManifestVehicle } from "../src/index.js";
import { manifestJson } from "./fixtures.js";

// Every mkdtemp'd directory this suite creates, removed after each test regardless of pass/fail
// -- otherwise every run leaks its own tmpdir permanently.
const createdDirs: string[] = [];
afterEach(async () => {
	await Promise.all(createdDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});
async function tempDir(prefix: string): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), prefix));
	createdDirs.push(dir);
	return dir;
}

describe("Armada manifest store", () => {
	it("atomically upserts and removes Vehicles without replacing the fleet", async () => {
		const directory = await tempDir("armada-manifest-");
		const path = join(directory, "armada.json");
		await writeFile(path, manifestJson());
		const lector = {
			name: "lector",
			version: "1.0.0",
			executable: "/opt/lector/cli.js",
			arguments: ["serve"],
			handlePath: "/run/user/1000/lector/handle.json",
			restart: { policy: "never" },
			readiness: { timeoutMs: 5_000, pollIntervalMs: 100 },
		};
		expect((await upsertManifestVehicle(path, JSON.stringify(lector))).ok).toBe(true);
		expect(JSON.parse(await readFile(path, "utf8")).vehicles.map((item: { name: string }) => item.name)).toEqual(["lector", "papyrus"]);
		expect((await removeManifestVehicle(path, "papyrus")).ok).toBe(true);
		expect(JSON.parse(await readFile(path, "utf8")).vehicles.map((item: { name: string }) => item.name)).toEqual(["lector"]);
	});

	it("rejects malformed Vehicle input without changing the manifest", async () => {
		const directory = await tempDir("armada-manifest-");
		const path = join(directory, "armada.json");
		const original = manifestJson();
		await writeFile(path, original);
		const outcome = await upsertManifestVehicle(path, JSON.stringify({ name: "bad" }));
		expect(outcome).toMatchObject({ ok: false, diagnostics: [{ code: "MANIFEST_SCHEMA_INVALID" }] });
		expect(await readFile(path, "utf8")).toBe(original);
	});
});
