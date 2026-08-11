import type { VehicleContentBlock, VehicleManifest, VehicleOperationDescriptor } from "@danypops/vehicle-core";
import { extractVehicleContent } from "@danypops/vehicle-core";
import { publishVehicleActivity } from "./activity-broker.js";
import type { PiVehicleIdentity } from "./vehicle-pi.js";

/**
 * Low-level, pure/standalone helpers shared across vehicle-pi.ts's own sibling modules
 * (vehicle-safety-classification.ts, vehicle-manifest-handshake.ts, vehicle-job-polling.ts,
 * vehicle-local-approval.ts) and vehicle-pi.ts itself. Extracted as its own leaf module (no
 * dependency on any of those siblings) specifically to avoid circular imports: everything here
 * is a pure function or a single external-dependency wrapper, never an orchestrator that needs
 * to import back from one of the feature modules.
 */

export function formatJson(value: unknown): string {
	const text = JSON.stringify(value, null, 2);
	if (text === undefined) throw new Error("Vehicle returned a non-JSON result");
	return text;
}

export function displayLabel(descriptor: VehicleOperationDescriptor): string {
	return descriptor.name
		.split(/[^a-zA-Z0-9]+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

export function operationKey(descriptor: Pick<VehicleOperationDescriptor, "name" | "version">): string {
	return `${descriptor.name}@${descriptor.version}`;
}

export function defaultToolName(descriptor: VehicleOperationDescriptor, versioned: boolean): string {
	const base = descriptor.name
		.toLowerCase()
		.replace(/[^a-z0-9_]+/g, "_")
		.replace(/_+/g, "_")
		.replace(/^_+|_+$/g, "");
	if (!base) throw new Error(`Vehicle operation ${descriptor.name}@${descriptor.version} has no valid Pi tool name`);
	return versioned ? `${base}_v${descriptor.version}` : base;
}

/**
 * Same superset check VehicleRegistry.invoke() already enforces at
 * invoke-time -- this is that same rule applied one step earlier, to tool
 * *visibility*, so a caller never sees a tool it has no permissions to call
 * in the first place. An operation with no declared permissions is always
 * satisfied, matching the registry's own "missing.length === 0" logic.
 */
export function permissionsSatisfied(required: readonly string[], granted: readonly string[] | undefined): boolean {
	if (required.length === 0) return true;
	const grantedSet = new Set(granted ?? []);
	return required.every((permission) => grantedSet.has(permission));
}

export function vehicleIdentity(manifest: VehicleManifest, descriptor: VehicleOperationDescriptor, toolCallId: string): PiVehicleIdentity {
	return {
		name: manifest.name,
		version: manifest.version,
		operation: descriptor.name,
		operationVersion: descriptor.version,
		toolCallId,
	};
}

/**
 * Side-channel telemetry only -- a true no-op unless some other extension has
 * called registerActivityBroker() (see activity-broker.ts). Never gated
 * behind a RegisterVehicleToolsOptions flag: the broker's own absence is
 * already the opt-in mechanism, matching vstack's own unconditional-call
 * convention this primitive is ported from.
 */
export function publishOperationActivity(
	kind: "started" | "completed" | "failed",
	identity: PiVehicleIdentity,
	descriptor: VehicleOperationDescriptor,
	details?: Record<string, unknown>,
): void {
	publishVehicleActivity({
		type: `vehicle.operation.${kind}`,
		source: "vehicle",
		severity: kind === "failed" ? "error" : kind === "completed" ? "success" : "info",
		importance:
			kind === "started" ? "noisy" : descriptor.effect === "destructive" || descriptor.effect === "open-world" ? "important" : "normal",
		summary: `${operationKey(descriptor)} ${kind}`,
		refs: {
			vehicleName: identity.name,
			operation: identity.operation,
			operationVersion: identity.operationVersion,
			toolCallId: identity.toolCallId,
		},
		details: { effect: descriptor.effect, ...details },
		ts: new Date().toISOString(),
	});
}

export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export const DEFAULT_MODEL_CONTENT_MAX_BYTES = 16 * 1024;
const textEncoder = new TextEncoder();
// biome-ignore lint/complexity/useRegexLiterals: a constructor avoids control-character lint on the equivalent literal.
const ANSI_ESCAPE_PATTERN = new RegExp("\\u001B(?:\\[[0-?]*[ -/]*[@-~]|\\][^\\u0007]*(?:\\u0007|\\u001B\\\\))", "g");

function utf8Bytes(text: string): number {
	return textEncoder.encode(text).byteLength;
}

function truncateUtf8(text: string, maxBytes: number): string {
	if (maxBytes <= 0) return "";
	if (utf8Bytes(text) <= maxBytes) return text;
	let low = 0;
	let high = text.length;
	while (low < high) {
		const middle = Math.ceil((low + high) / 2);
		if (utf8Bytes(text.slice(0, middle)) <= maxBytes) low = middle;
		else high = middle - 1;
	}
	let end = low;
	if (end > 0 && /[\uD800-\uDBFF]/.test(text[end - 1]!)) end--;
	return text.slice(0, end);
}

/** Applies the Pi transcript budget to semantic blocks and JSON fallback alike, stripping terminal-only ANSI first. */
export function boundVehicleModelContent(
	content: readonly VehicleContentBlock[],
	maxBytes = DEFAULT_MODEL_CONTENT_MAX_BYTES,
): readonly VehicleContentBlock[] {
	if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error("modelContentMaxBytes must be a positive integer");
	const clean = content.map((block) => ({ type: "text" as const, text: block.text.replace(ANSI_ESCAPE_PATTERN, "") }));
	const totalBytes = clean.reduce((total, block) => total + utf8Bytes(block.text), 0);
	if (totalBytes <= maxBytes) return clean;

	const joined = clean.map((block) => block.text).join("\n\n");
	let retained = Math.max(0, maxBytes - 96);
	let prefix = truncateUtf8(joined, retained);
	for (let attempt = 0; attempt < 4; attempt++) {
		const omittedBytes = Math.max(0, utf8Bytes(joined) - utf8Bytes(prefix));
		const notice = `\n\n[Vehicle model content truncated: omitted ${omittedBytes} UTF-8 bytes; complete=false]`;
		retained = Math.max(0, maxBytes - utf8Bytes(notice));
		prefix = truncateUtf8(joined, retained);
		if (utf8Bytes(prefix) + utf8Bytes(notice) <= maxBytes) return [{ type: "text", text: `${prefix}${notice}` }];
	}
	const notice = `[Vehicle model content truncated; complete=false]`;
	return [{ type: "text", text: truncateUtf8(notice, maxBytes) }];
}

export function modelContentFor(output: unknown, maxBytes: number | undefined): readonly VehicleContentBlock[] {
	const content = extractVehicleContent(output) ?? [{ type: "text" as const, text: formatJson(output) }];
	return boundVehicleModelContent(content, maxBytes ?? DEFAULT_MODEL_CONTENT_MAX_BYTES);
}
