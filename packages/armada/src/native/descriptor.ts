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
 * Mixes each strategy's own renderer fingerprint into the hash a plan
 * compares against the already-installed descriptor's own recorded spec
 * hash -- deliberately NOT a bare `manifestHash(vehicle)`. A vehicle's own
 * spec can stay byte-identical across a renderer-only change (e.g. a fixed
 * env var name, a new hardcoded unit line) that still changes what actually
 * gets installed; without this, planFleet's `actual.specHash !== specHash`
 * drift check never fires for that class of change, and an already-deployed
 * unit is silently never re-installed no matter how many times reconcile
 * runs.
 *
 * The fingerprint is each strategy's own `generateDescriptor.toString()` --
 * its real source text, not a hand-maintained version integer. This was a
 * genuine, lived incident: a prior version of this file used a manually-
 * bumped RENDERER_VERSION constant, which depended on a human remembering
 * to bump it every time generateDescriptor's own output changed -- exactly
 * the kind of forgettable discipline that let the original
 * DAEMON_KIT_LAUNCH_PROVENANCE rename go undetected for weeks. Deriving the
 * fingerprint from the function's own source closes that gap unconditionally:
 * any future edit to generateDescriptor's body changes this hash with zero
 * additional developer action, the same way systemd's own generator model
 * (systemd.generator(7)) has no cached-hash staleness problem at all because
 * generators simply re-run unconditionally every boot. A pure whitespace/
 * comment-only reformat also changes the fingerprint (an unnecessary but
 * harmless extra reconcile), which is the safe direction to be wrong in --
 * unlike a missed real change, which is silently, permanently wrong.
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
