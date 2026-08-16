/**
 * Tool creation/registration: projecting one Vehicle operation into a real Pi ToolDefinition, and
 * the dynamic per-operation activator the Vehicle Shell (tools_man) uses. Split out of
 * vehicle-pi.ts's own bundled concerns (Vehicle Pass 1 SRP audit finding #5).
 *
 * Takes invokeVehicleOperation as an injected dependency (ToolCreationDeps) rather than importing
 * it directly from vehicle-pi.ts -- that function (and the whole cross-cutting invocation-policy
 * layer around it: approval retry, local safety gate, presentation projection) stays in
 * vehicle-pi.ts per the audit's own finding, and importing it directly back from here would create
 * a real vehicle-pi.ts <-> tool-creation.ts import cycle (this repo's own import-x/no-cycle lint
 * rule forbids exactly that).
 */

import type {
	JsonValue,
	VehicleClient,
	VehicleManifest,
	VehicleManifestOperation,
	VehicleOperationDescriptor,
} from "@danypops/vehicle-core";
import { VEHICLE_APPROVAL_RESOLVE_OPERATION_NAME } from "@danypops/vehicle-core";
import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { TSchema } from "typebox";
import { tryExtensionRuntimeAction } from "../pi-tool-availability.js";
import type {
	PiVehiclePresentationProjector,
	PiVehicleToolDetails,
	RegisteredPiVehicleTool,
	RegisterVehicleToolsOptions,
	VehicleOperationInvocationParams,
	VehicleOperationInvocationResult,
} from "../vehicle-pi.js";
import { defaultToolName, displayLabel, operationKey } from "../vehicle-pi-primitives.js";
import { renderVehicleCall, renderVehicleResult } from "../vehicle-render.js";
import {
	DEFAULT_PRESENTATION_MAX_BYTES,
	projectGenericVehiclePresentation,
	projectGenericVehicleProgress,
} from "../vehicle-render-model.js";

/**
 * Never projects VEHICLE_APPROVAL_RESOLVE_OPERATION_NAME as a Pi tool, even
 * when it's present in the manifest (any registry with configureApprovals()
 * enabled registers it) and the caller's own options.permissions happens to
 * cover its required permission. It is invoked exactly one way in this
 * package -- client.invoke() from inside the approval-required retry dance
 * in vehicle-pi.ts, using options.permissions the extension author fixed at
 * registration time -- never as a tool call a model can choose to make.
 * Exposing it as a model-callable tool would let a model grant its own
 * pending approval requests, defeating the human-in-the-loop point of the
 * gate entirely.
 */
export function projectedNames(
	manifest: VehicleManifest,
	nameProjector: NonNullable<RegisterVehicleToolsOptions["toolName"]>,
): Array<{ descriptor: VehicleManifestOperation; toolName: string }> {
	const versionCounts = new Map<string, number>();
	for (const descriptor of manifest.operations) {
		versionCounts.set(descriptor.name, (versionCounts.get(descriptor.name) ?? 0) + 1);
	}
	return manifest.operations
		.filter((descriptor) => descriptor.name !== VEHICLE_APPROVAL_RESOLVE_OPERATION_NAME)
		.map((descriptor) => ({
			descriptor,
			toolName: nameProjector(descriptor, (versionCounts.get(descriptor.name) ?? 0) > 1),
		}));
}

export function assertNamesAvailable(
	projected: readonly { descriptor: VehicleManifestOperation; toolName: string }[],
	existingToolNames: readonly string[],
): void {
	const owners = new Map<string, string>();
	for (const { descriptor, toolName } of projected) {
		if (!/^[a-zA-Z0-9_-]+$/.test(toolName)) {
			throw new Error(`Projected Pi tool name '${toolName}' for ${operationKey(descriptor)} is invalid`);
		}
		const owner = owners.get(toolName);
		if (owner) {
			throw new Error(`Pi tool name collision: ${owner} and ${operationKey(descriptor)} both project to '${toolName}'`);
		}
		owners.set(toolName, operationKey(descriptor));
	}
	const existing = new Set(existingToolNames);
	for (const { descriptor, toolName } of projected) {
		if (existing.has(toolName)) {
			throw new Error(`Pi tool '${toolName}' is already registered; refusing to override it with ${operationKey(descriptor)}`);
		}
	}
}

const GENERIC_PRESENTATION_PROJECTOR: PiVehiclePresentationProjector = Object.freeze({
	maxBytes: DEFAULT_PRESENTATION_MAX_BYTES,
	project: (output: unknown) => projectGenericVehiclePresentation(output, DEFAULT_PRESENTATION_MAX_BYTES) as unknown as JsonValue,
	projectProgress: (progress: unknown) => projectGenericVehicleProgress(progress, DEFAULT_PRESENTATION_MAX_BYTES) as unknown as JsonValue,
});

/** The one real (non-type) coupling this module has back to vehicle-pi.ts's own invocation-policy
 * layer -- injected rather than imported directly, to avoid a real import cycle. */
export interface ToolCreationDeps {
	readonly invoke: (params: VehicleOperationInvocationParams) => Promise<VehicleOperationInvocationResult>;
}

export function createTool(
	deps: ToolCreationDeps,
	client: VehicleClient,
	manifest: VehicleManifest,
	descriptor: VehicleOperationDescriptor,
	toolName: string,
	options: RegisterVehicleToolsOptions,
): ToolDefinition<TSchema, PiVehicleToolDetails> {
	const overrides = options.renderers?.(descriptor);
	const presentation = options.presentations?.(descriptor);
	// A custom legacy renderResult with no paired projector keeps {vehicle, output}; every generic row uses the bounded v1 DTO.
	const presentationProjector = presentation?.projector ?? (overrides?.renderResult ? undefined : GENERIC_PRESENTATION_PROJECTOR);
	return {
		name: toolName,
		label: displayLabel(descriptor),
		description: descriptor.description,
		// Without this, Pi omits the tool from the "Available tools" section of
		// its default system prompt entirely -- confirmed live: a projected tool
		// was registered and technically callable, but the model had no way to
		// know it existed and reported it as unavailable when asked directly.
		promptSnippet: descriptor.description,
		parameters: descriptor.inputSchema as TSchema,
		executionMode: options.executionMode?.(descriptor),
		renderCall: overrides?.renderCall ?? ((args, theme, context) => renderVehicleCall(descriptor, args, theme, context)),
		renderResult:
			presentation?.renderResult ??
			overrides?.renderResult ??
			((result, resultOptions, theme, context) =>
				renderVehicleResult(descriptor, result, resultOptions, theme, context, options.progressBarGlyphs, options.renderPresenters)),
		async execute(toolCallId, input, signal, onUpdate, context) {
			const result = await deps.invoke({
				client,
				manifest,
				descriptor,
				toolName,
				toolCallId,
				input,
				context,
				signal,
				onUpdate,
				options,
				presentationProjector,
			});
			return { content: [...result.content], details: result.details };
		},
	};
}

/**
 * Builds this vehicle's own operation-activation closure -- the one thing every vehicle supplies
 * into the shared in-process registry (vehicle-shell-registry.ts's registerInProcessVehicle) so
 * the process-wide, vehicle-agnostic tools_man (vehicle-shell.ts) can dynamically activate any of
 * this vehicle's own non-core operations using THIS vehicle's own permissions/principal/renderers/
 * safety policy -- never borrowed from whichever vehicle happens to house the shared meta-tools'
 * own creation call, the way a single accidental "owner" used to force on every other vehicle's
 * discovered operations.
 *
 * Also doubles as the mechanism for a genuinely new operation a fresh manifest re-fetch reveals
 * this vehicle's own initial registration never knew about (a daemon that hot-adds an operation
 * while this session is already running) -- the exact same createTool() every operation known at
 * registration time already gets, just called on demand instead of upfront.
 *
 * Tool name is namespaced by vehicle name up front (e.g. "packed_package_install") specifically so
 * two different vehicles can never collide with each other on a shared operation name; within one
 * vehicle's own operations, defaultToolName's own uniqueness already holds. Still guards against
 * every other kind of collision (this vehicle's own name colliding with an already-registered
 * tool, or the rare case of two distinct operations sanitizing to the same name) via the same
 * assertNamesAvailable check static registration already uses, surfacing a clear error tools_man
 * turns into a friendly non-crashing message rather than silently overwriting an existing tool.
 */
export function buildOperationActivator(
	deps: ToolCreationDeps,
	pi: ExtensionAPI,
	vehicleName: string,
	client: VehicleClient,
	manifest: VehicleManifest,
	options: RegisterVehicleToolsOptions,
): (descriptor: VehicleManifestOperation) => string {
	return (descriptor) => {
		const toolName = `${defaultToolName({ ...descriptor, name: vehicleName }, false)}_${defaultToolName(descriptor, false)}`;
		const runtime = tryExtensionRuntimeAction(() => pi.getAllTools());
		assertNamesAvailable([{ descriptor, toolName }], runtime.status === "ready" ? runtime.value.map((tool) => tool.name) : []);
		pi.registerTool(createTool(deps, client, manifest, descriptor, toolName, options));
		return toolName;
	};
}

/** RegisteredPiVehicleTool's own available/blocked facts, narrowed to what vehicle-shell.ts needs -- keeps that file from importing this one's own (much larger) type. vehicleName disambiguates operationName across vehicles now that one shared handle covers every vehicle in the process, not just this one. */
export function shellManagedTools(vehicleName: string, tools: readonly RegisteredPiVehicleTool[]) {
	return tools.map((tool) => ({
		vehicleName,
		toolName: tool.toolName,
		operationName: tool.operationName,
		available: tool.available,
		blocked: tool.safetyState === "blocked",
		weightTokens: tool.weightTokens,
	}));
}
