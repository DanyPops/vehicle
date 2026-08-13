import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type Diagnostic, diagnostic } from "../fleet/diagnostic.js";
import { manifestHash } from "../fleet/hash.js";
import { createNativeServiceIdentity, type ManifestHash, type NativeServiceIdentity } from "../fleet/identity.js";
import type { VehicleResources, VehicleSpec } from "../fleet/manifest.js";
import type { NativeManagerCapabilities } from "./service-manager.js";

const RESOURCE_KEYS = [
	"memoryHighBytes",
	"maximumMemoryBytes",
	"memoryLowPercent",
	"memoryHighPercent",
	"maximumMemoryPercent",
	"cpuWeight",
	"maximumCpuPercent",
	"maximumTasks",
] as const;
const RUNTIME_KEYS = ["preventPrivilegeEscalation", "privateTemporaryDirectory", "networkReadiness"] as const;

export function nativeServiceIdentity(value: string): NativeServiceIdentity {
	const outcome = createNativeServiceIdentity(value);
	if (!outcome.ok) throw new Error(`invalid native service identity: ${outcome.reason}`);
	return outcome.value;
}

/**
 * A module's own compiled file bytes, keyed by its `import.meta.url`. NOT
 * `generateDescriptor.toString()`: confirmed live, Bun and Node serialize
 * function source differently (JavaScriptCore vs V8), so the same published
 * file produced two different fingerprints depending on which runtime
 * loaded it. Reading the file directly sidesteps that -- plain file I/O is
 * byte-identical everywhere.
 */
export function moduleSourceFingerprint(moduleUrl: string): string {
	return readFileSync(fileURLToPath(moduleUrl), "utf8");
}

/**
 * Mixes a renderer fingerprint into the hash a plan compares against the
 * installed descriptor's own recorded spec hash -- NOT a bare
 * `manifestHash(vehicle)`. A vehicle's spec can stay identical across a
 * renderer-only change (e.g. a fixed env var name); without this,
 * planFleet's drift check never fires and an already-deployed unit is
 * never re-installed. The fingerprint is the strategy module's own file
 * content (see moduleSourceFingerprint) rather than a hand-bumped version
 * constant, so any future edit is caught automatically.
 */
export function descriptorSpecHash(vehicle: VehicleSpec, rendererFingerprint: string): ManifestHash {
	return manifestHash({ vehicle, rendererFingerprint });
}

function resourceDiagnostics(resources: VehicleResources | undefined, capabilities: NativeManagerCapabilities): Diagnostic[] {
	if (!resources) return [];
	const diagnostics: Diagnostic[] = [];
	for (const key of RESOURCE_KEYS) {
		const requirement = resources[key];
		if (!requirement || capabilities[key]) continue;
		const required = requirement.enforcement === "required";
		diagnostics.push(
			diagnostic(
				required ? "NATIVE_RESOURCE_UNSUPPORTED_REQUIRED" : "NATIVE_RESOURCE_UNSUPPORTED_OPTIONAL",
				required ? "error" : "warning",
				`/resources/${key}`,
				`${key} is not supported by this native manager`,
			),
		);
	}
	return diagnostics;
}

function runtimeDiagnostics(vehicle: VehicleSpec, capabilities: NativeManagerCapabilities): Diagnostic[] {
	if (!vehicle.runtime) return [];
	const diagnostics: Diagnostic[] = [];
	for (const key of RUNTIME_KEYS) {
		const requirement = vehicle.runtime[key];
		if (!requirement || capabilities[key]) continue;
		const required = requirement.enforcement === "required";
		diagnostics.push(
			diagnostic(
				required ? "NATIVE_RUNTIME_UNSUPPORTED_REQUIRED" : "NATIVE_RUNTIME_UNSUPPORTED_OPTIONAL",
				required ? "error" : "warning",
				`/runtime/${key}`,
				`${key} is not supported by this native manager`,
			),
		);
	}
	return diagnostics;
}

function restartDiagnostics(vehicle: VehicleSpec, capabilities: NativeManagerCapabilities): Diagnostic[] {
	if (vehicle.restart.policy === "never") return [];
	const supportsMode = vehicle.restart.policy === "always" ? capabilities.restartAlways : capabilities.restartOnFailure;
	if (!supportsMode) {
		return [
			diagnostic(
				"NATIVE_RESTART_MODE_UNSUPPORTED",
				"error",
				"/restart/policy",
				`${vehicle.restart.policy} is not supported by this native manager`,
			),
		];
	}
	if (!capabilities.restartAttemptLimit) {
		return [
			diagnostic(
				"NATIVE_RESTART_ATTEMPT_LIMIT_UNSUPPORTED",
				"error",
				"/restart/maxAttempts",
				"bounded restart attempts are not supported by this native manager",
			),
		];
	}
	if (!capabilities.restartAttemptWindow) {
		return [
			diagnostic(
				"NATIVE_RESTART_WINDOW_UNSUPPORTED",
				"warning",
				"/restart/windowMs",
				"restart attempts are bounded, but the native manager cannot enforce the requested time window",
			),
		];
	}
	return [];
}

function descriptorTextDiagnostics(vehicle: VehicleSpec): Diagnostic[] {
	const values = [
		["/executable", vehicle.executable],
		...vehicle.arguments.map((value, index) => [`/arguments/${index}`, value] as const),
		...(vehicle.workingDirectory === undefined ? [] : [["/workingDirectory", vehicle.workingDirectory] as const]),
		...Object.entries(vehicle.env ?? {}).map(([key, value]) => [`/env/${key}`, value] as const),
	] as const;
	for (const [path, value] of values) {
		const hasControlCharacter = [...value].some((character) => {
			const code = character.charCodeAt(0);
			return code < 32 || code === 127;
		});
		if (hasControlCharacter) {
			return [diagnostic("NATIVE_DESCRIPTOR_TEXT_INVALID", "error", path, "native descriptor text cannot contain control characters")];
		}
	}
	return [];
}

export function capabilityDiagnostics(vehicle: VehicleSpec, capabilities: NativeManagerCapabilities): readonly Diagnostic[] {
	return Object.freeze([
		...descriptorTextDiagnostics(vehicle),
		...resourceDiagnostics(vehicle.resources, capabilities),
		...runtimeDiagnostics(vehicle, capabilities),
		...restartDiagnostics(vehicle, capabilities),
	]);
}

export function hasError(diagnostics: readonly Diagnostic[]): boolean {
	return diagnostics.some((item) => item.severity === "error");
}

export function sortedEnvEntries(vehicle: VehicleSpec): ReadonlyArray<readonly [string, string]> {
	return Object.entries(vehicle.env ?? {}).sort(([left], [right]) => left.localeCompare(right));
}

export function xmlEscape(value: string): string {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export function seconds(milliseconds: number): string {
	return String(milliseconds / 1_000).replace(/\.0+$/, "");
}
