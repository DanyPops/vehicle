import { describe, expect, it } from "bun:test";
import { decodeArmadaManifest, MAX_MANIFEST_BYTES } from "../src/index.js";
import { manifestJson } from "./fixtures.js";

describe("decodeArmadaManifest", () => {
	it("decodes, brands, sorts, hashes, and freezes a valid manifest", () => {
		const outcome = decodeArmadaManifest(
			manifestJson([
				JSON.parse(manifestJson()).vehicles[0],
				{
					...JSON.parse(manifestJson()).vehicles[0],
					name: "lector",
					executable: "C:\\Tools\\lector.exe",
					handlePath: "C:\\Temp\\lector.json",
				},
			]),
		);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(outcome.manifest.vehicles.map((item) => String(item.name))).toEqual(["lector", "papyrus"]);
		expect(outcome.manifest.contentHash).toMatch(/^[a-f0-9]{64}$/);
		expect(Object.isFrozen(outcome.manifest)).toBe(true);
		expect(Object.isFrozen(outcome.manifest.vehicles[0])).toBe(true);
	});

	it.each([
		["oversized", `${" ".repeat(MAX_MANIFEST_BYTES)}xx`, "MANIFEST_TOO_LARGE"],
		["invalid JSON", "{", "MANIFEST_JSON_INVALID"],
		["unknown field", JSON.stringify({ schemaVersion: 1, vehicles: [], unknown: true }), "MANIFEST_SCHEMA_INVALID"],
		[
			"relative executable",
			manifestJson([{ ...JSON.parse(manifestJson()).vehicles[0], executable: "bin/papyrus" }]),
			"MANIFEST_PATH_NOT_ABSOLUTE",
		],
		[
			"secret",
			manifestJson([{ ...JSON.parse(manifestJson()).vehicles[0], arguments: ["--token=raw-secret"] }]),
			"MANIFEST_SECRET_MATERIAL",
		],
	])("rejects %s", (_name, text, code) => {
		const outcome = decodeArmadaManifest(text);
		expect(outcome.ok).toBe(false);
		if (outcome.ok) return;
		expect(outcome.diagnostics.map((item) => item.code)).toContain(code);
	});

	it("accepts either memory boundary independently and together", () => {
		const base = JSON.parse(manifestJson()).vehicles[0];
		for (const resources of [
			{ memoryHighBytes: { value: 536_870_912, enforcement: "required" } },
			{ maximumMemoryBytes: { value: 805_306_368, enforcement: "required" } },
			{
				memoryHighBytes: { value: 536_870_912, enforcement: "required" },
				maximumMemoryBytes: { value: 805_306_368, enforcement: "required" },
			},
		]) {
			const outcome = decodeArmadaManifest(manifestJson([{ ...base, resources }]));
			expect(outcome.ok).toBe(true);
		}
	});

	it("rejects a memory high boundary above its maximum", () => {
		const base = JSON.parse(manifestJson()).vehicles[0];
		const outcome = decodeArmadaManifest(
			manifestJson([
				{
					...base,
					resources: {
						memoryHighBytes: { value: 805_306_368, enforcement: "required" },
						maximumMemoryBytes: { value: 536_870_912, enforcement: "required" },
					},
				},
			]),
		);
		expect(outcome.ok).toBe(false);
		if (outcome.ok) return;
		expect(outcome.diagnostics).toEqual([
			expect.objectContaining({
				code: "MANIFEST_MEMORY_ENVELOPE_INVALID",
				path: "/vehicles/0/resources/memoryHighBytes",
			}),
		]);
	});

	it("rejects duplicate Vehicle names", () => {
		const one = JSON.parse(manifestJson()).vehicles[0];
		const outcome = decodeArmadaManifest(manifestJson([one, one]));
		expect(outcome.ok).toBe(false);
		if (outcome.ok) return;
		expect(outcome.diagnostics[0]?.code).toBe("MANIFEST_VEHICLE_DUPLICATE");
	});

	it("accepts and preserves a Vehicle's env map", () => {
		const outcome = decodeArmadaManifest(manifestJson([{ ...JSON.parse(manifestJson()).vehicles[0], env: { PI_BIN: "/abs/path/pi" } }]));
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(outcome.manifest.vehicles[0]?.env).toEqual({ PI_BIN: "/abs/path/pi" });
	});

	it("accepts and preserves portable runtime requirements", () => {
		const runtime = {
			preventPrivilegeEscalation: { enforcement: "required" },
			privateTemporaryDirectory: { enforcement: "optional" },
			networkReadiness: { enforcement: "required" },
		} as const;
		const outcome = decodeArmadaManifest(manifestJson([{ ...JSON.parse(manifestJson()).vehicles[0], runtime }]));
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(outcome.manifest.vehicles[0]?.runtime).toEqual(runtime);
	});

	it("rejects an env key that isn't a valid environment-variable name", () => {
		const outcome = decodeArmadaManifest(manifestJson([{ ...JSON.parse(manifestJson()).vehicles[0], env: { "not-a-valid-name": "x" } }]));
		expect(outcome.ok).toBe(false);
		if (outcome.ok) return;
		expect(outcome.diagnostics.map((item) => item.code)).toContain("MANIFEST_SCHEMA_INVALID");
	});
});
