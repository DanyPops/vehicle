import type { VehicleSpec } from "../fleet/manifest.js";
import { capabilityDiagnostics, descriptorSpecHash, hasError, nativeServiceIdentity, seconds, sortedEnvEntries } from "./descriptor.js";

/** Bump whenever generateDescriptor's own output changes for some existing vehicle spec -- see descriptorSpecHash. */
const RENDERER_VERSION = 2;

import type { DescriptorOutcome, NativeManagerCapabilities, NativeServiceStrategy } from "./service-manager.js";

const capabilities: NativeManagerCapabilities = Object.freeze({
	memoryHighBytes: true,
	maximumMemoryBytes: true,
	memoryLowPercent: true,
	memoryHighPercent: true,
	maximumMemoryPercent: true,
	cpuWeight: true,
	maximumCpuPercent: true,
	maximumTasks: true,
	restartAlways: true,
	restartOnFailure: true,
	restartAttemptLimit: true,
	restartAttemptWindow: true,
	preventPrivilegeEscalation: true,
	privateTemporaryDirectory: true,
	networkReadiness: true,
});

function quote(value: string): string {
	let result = '"';
	for (const character of value) {
		const code = character.charCodeAt(0);
		if (character === "\\") result += "\\\\";
		else if (character === '"') result += '\\"';
		else if (code < 32 || code === 127) result += `\\x${code.toString(16).padStart(2, "0")}`;
		else result += character;
	}
	return `${result}"`;
}

function generateDescriptor(vehicle: VehicleSpec): DescriptorOutcome {
	const diagnostics = capabilityDiagnostics(vehicle, capabilities);
	if (hasError(diagnostics)) return { ok: false, diagnostics };
	const specHash = descriptorSpecHash(vehicle, RENDERER_VERSION);
	const unitName = `armada-${vehicle.name}.service`;
	const unit: string[] = ["[Unit]", `Description=Armada Vehicle ${vehicle.name}`, `X-Armada-SpecHash=${specHash}`];
	if (vehicle.runtime?.networkReadiness) unit.push("After=network-online.target", "Wants=network-online.target");
	if (vehicle.restart.policy !== "never") {
		unit.push(`StartLimitIntervalSec=${seconds(vehicle.restart.windowMs)}`, `StartLimitBurst=${vehicle.restart.maxAttempts + 1}`);
	}
	unit.push(
		"",
		"[Service]",
		"Type=simple",
		'Environment="VEHICLE_LAUNCH_PROVENANCE=service"',
		...sortedEnvEntries(vehicle).map(([key, value]) => `Environment=${quote(`${key}=${value}`)}`),
		`ExecStart=${[vehicle.executable, ...vehicle.arguments].map(quote).join(" ")}`,
	);
	if (vehicle.workingDirectory !== undefined) unit.push(`WorkingDirectory=${quote(vehicle.workingDirectory)}`);
	if (vehicle.restart.policy === "never") unit.push("Restart=no");
	else unit.push(`Restart=${vehicle.restart.policy}`, `RestartSec=${seconds(vehicle.restart.delayMs)}`);
	if (vehicle.runtime?.preventPrivilegeEscalation) unit.push("NoNewPrivileges=true");
	if (vehicle.runtime?.privateTemporaryDirectory) unit.push("PrivateTmp=true");
	const resources = vehicle.resources;
	if (resources?.memoryLowPercent) unit.push(`MemoryLow=${resources.memoryLowPercent.value}%`);
	if (resources?.memoryHighBytes) unit.push(`MemoryHigh=${resources.memoryHighBytes.value}`);
	if (resources?.memoryHighPercent) unit.push(`MemoryHigh=${resources.memoryHighPercent.value}%`);
	if (resources?.maximumMemoryBytes) unit.push(`MemoryMax=${resources.maximumMemoryBytes.value}`);
	if (resources?.maximumMemoryPercent) unit.push(`MemoryMax=${resources.maximumMemoryPercent.value}%`);
	if (resources?.cpuWeight) unit.push(`CPUWeight=${resources.cpuWeight.value}`);
	if (resources?.maximumCpuPercent) unit.push(`CPUQuota=${resources.maximumCpuPercent.value}%`);
	if (resources?.maximumTasks) unit.push(`TasksMax=${resources.maximumTasks.value}`);
	unit.push("", "[Install]", "WantedBy=armada.target", "");
	return {
		ok: true,
		descriptor: Object.freeze({
			kind: "systemd",
			identity: nativeServiceIdentity(unitName),
			fileName: unitName,
			specHash,
			content: unit.join("\n"),
		}),
		diagnostics,
	};
}

export const systemdStrategy: NativeServiceStrategy = Object.freeze({ kind: "systemd", capabilities, generateDescriptor });
