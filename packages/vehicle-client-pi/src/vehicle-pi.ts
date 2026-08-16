import type {
	AtomicJsonFsAdapter,
	JsonValue,
	VehicleClient,
	VehicleContentBlock,
	VehicleEffect,
	VehicleFailure,
	VehicleInvocationOptions,
	VehicleManifest,
	VehicleOperationDescriptor,
	VehiclePrincipal,
} from "@danypops/vehicle-core";
import { VEHICLE_APPROVAL_RESOLVE_OPERATION_NAME } from "@danypops/vehicle-core";
import type {
	AgentToolUpdateCallback,
	ExtensionAPI,
	ExtensionContext,
	ToolDefinition,
	ToolExecutionMode,
} from "@earendil-works/pi-coding-agent";
import type { ProgressBarGlyphStyle, ProgressBarGlyphs } from "malevich-tui-components";
import type { TSchema } from "typebox";
import type { PiHitlPresentation } from "./hitl-prompt.js";
import { guardExtensionRuntimeInitialized, syncManagedActiveTools, tryExtensionRuntimeAction } from "./pi-tool-availability.js";
import { DEFAULT_JOB_POLL_INTERVAL_MS, invokeOrRunAsJob, type RegisterVehicleToolsJobOptions } from "./vehicle-job-polling.js";
import { type LocalApprovalRequester, type RegisterVehicleToolsApprovalOptions, requestLocalApproval } from "./vehicle-local-approval.js";
import {
	persistManifestCache,
	type RegisterVehicleToolsHandshakeOptions,
	resolveManifestForRegistration,
} from "./vehicle-manifest-handshake.js";
import type { RegisterVehicleToolsWhenReadyOptions } from "./vehicle-pi/ready-retry.js";
import { registerVehicleToolsWhenReady as registerVehicleToolsWhenReadyImpl } from "./vehicle-pi/ready-retry.js";
import { reportRenderCoverageGaps } from "./vehicle-pi/render-coverage.js";
import {
	assertNamesAvailable,
	buildOperationActivator,
	createTool,
	projectedNames,
	shellManagedTools,
} from "./vehicle-pi/tool-creation.js";
import {
	boundVehicleModelContent,
	defaultToolName,
	formatJson,
	modelContentFor,
	operationKey,
	permissionsSatisfied,
	publishOperationActivity,
	vehicleIdentity,
} from "./vehicle-pi-primitives.js";
import type { VehiclePresenter } from "./vehicle-render.js";
import { assertJsonSafePresentation } from "./vehicle-render-model.js";
import type { RegisterVehicleToolsSafetyOptions, VehicleSafetyPolicyStore, VehicleSafetyState } from "./vehicle-safety.js";
import {
	approvalRequestId,
	contributeToSafetyRegistry,
	PiVehicleInvocationError,
	resolveSafetyState,
	sanitizedFailure,
} from "./vehicle-safety-classification.js";
import {
	applyVehicleShellActivation,
	refreshVehicleShellManagedTools,
	registerVehicleShell,
	type VehicleShellHandle,
	type VehicleShellOptions,
} from "./vehicle-shell.js";
import { registerInProcessVehicle } from "./vehicle-shell-registry.js";

export type { RegisterVehicleToolsJobOptions } from "./vehicle-job-polling.js";
export type {
	LocalApprovalPrompt,
	LocalApprovalRequester,
	LocalApprovalRequestParams,
	RegisterVehicleToolsApprovalOptions,
} from "./vehicle-local-approval.js";
export type { RegisterVehicleToolsHandshakeOptions } from "./vehicle-manifest-handshake.js";
export type {
	RegisterVehicleToolsWhenReadyOptions,
	VehicleReadyEvent,
	VehicleReadyRetryOptions,
} from "./vehicle-pi/ready-retry.js";
export {
	boundVehicleModelContent,
	DEFAULT_MODEL_CONTENT_MAX_BYTES,
} from "./vehicle-pi-primitives.js";
// RegisterVehicleToolsSafetyOptions also has its own public subpath ("./vehicle-safety") since
// vehicle-safety.ts is independently exported for VehicleSafetyPolicyStore's own sake -- re-export
// here too so a consumer building RegisterVehicleToolsOptions's `safety` group doesn't have to
// know that subpath exists just to name its type, matching every other grouped option above.
export type { RegisterVehicleToolsSafetyOptions } from "./vehicle-safety.js";
export { PiVehicleInvocationError } from "./vehicle-safety-classification.js";

export interface PiVehicleIdentity {
	readonly name: string;
	readonly version: string;
	readonly operation: string;
	readonly operationVersion: number;
	readonly toolCallId: string;
}

export interface PiVehicleToolDetails {
	readonly vehicle: PiVehicleIdentity;
	/** Versioned, JSON-safe human-presentation DTO persisted for new projected rows. */
	readonly presentation?: JsonValue;
	/** Legacy compatibility only: historical/custom renderers may still consume raw output during the documented migration window. */
	readonly output?: unknown;
	/** Transient legacy progress compatibility; final rows do not persist this field. */
	readonly progress?: unknown;
}

export interface PiVehicleInvocationRequest {
	readonly descriptor: VehicleOperationDescriptor;
	readonly manifest: VehicleManifest;
	readonly toolName: string;
	readonly toolCallId: string;
	readonly input: unknown;
	readonly context: ExtensionContext;
	/** The tool call's own cancellation signal -- present on every request; here for interactiveFollowUps (or any future consumer) to make its own extra round trip abortable too. */
	readonly signal?: AbortSignal;
	/** The tool call's own progress-update callback -- lets an interactiveFollowUp report an in-progress status (e.g. "waiting for a human answer") the same way the primary invoke()'s own onProgress does. */
	readonly onUpdate?: AgentToolUpdateCallback<PiVehicleToolDetails>;
}

export type PiVehicleInvocationResolver = (
	request: PiVehicleInvocationRequest,
) => VehicleInvocationOptions | Promise<VehicleInvocationOptions>;

export interface VehicleToolRenderers {
	readonly renderCall?: ToolDefinition<TSchema, PiVehicleToolDetails>["renderCall"];
	readonly renderResult?: ToolDefinition<TSchema, PiVehicleToolDetails>["renderResult"];
}

export interface PiVehiclePresentationProjector {
	/** Required bound over UTF-8 JSON bytes of the projector's return value. */
	readonly maxBytes: number;
	/** Runs once after the successful invocation and any interactive follow-up, before Pi persists details. */
	project(output: unknown, request: PiVehicleInvocationRequest): JsonValue | Promise<JsonValue>;
	/** Optional synchronous projection for transient progress updates. A failure drops that update and never aborts the invocation. */
	projectProgress?(progress: unknown, request: PiVehicleInvocationRequest): JsonValue;
}

/** Keeps a custom renderer and the exact persisted DTO contract it parses next to each other. */
export interface PiVehiclePresentationContract {
	readonly projector: PiVehiclePresentationProjector;
	readonly renderResult: ToolDefinition<TSchema, PiVehicleToolDetails>["renderResult"];
}

export interface PiVehicleFollowUpResult {
	readonly content: readonly VehicleContentBlock[];
	/** Replaces the human-facing details.output the primary invoke() would otherwise carry; details.vehicle is always the real identity regardless. */
	readonly output?: unknown;
}

/**
 * An optional client-local interactive step run after a successful invoke(),
 * before the tool result is returned to the model -- for an operation whose
 * own real UX needs more than "call it, show the output" (e.g. an operation
 * that durably records something and separately wants to offer a synchronous
 * human round-trip when ctx.hasUI allows one). Returning undefined falls back
 * to the default content/details built from the primary output; a thrown
 * error propagates as a real tool failure -- the primary invoke() already
 * succeeded and is not rolled back, matching this same contract on any other
 * mutating operation whose follow-up step fails.
 *
 * Deliberately distinct from the Approval Gate's own shared local-approval fast path
 * (baked directly into execute() itself, since every gated operation needs
 * the identical approval-required/resolve dance): this hook is for a
 * per-operation, per-consumer interactive shape nothing else shares, the way
 * Papyrus's discuss.open/discuss.reply use it to offer a live human answer.
 */
export type PiVehicleInteractiveFollowUp = (
	request: PiVehicleInvocationRequest,
	output: unknown,
	client: VehicleClient,
) => Promise<PiVehicleFollowUpResult | undefined>;

/**
 * registerVehicleTools()'s human-TUI rendering options, grouped out of RegisterVehicleToolsOptions's
 * own flat option list. Stays co-located here (rather than moving into vehicle-render.ts, the way
 * RegisterVehicleToolsApprovalOptions/RegisterVehicleToolsJobOptions moved into their own owning
 * modules) because two of its own field types -- VehicleToolRenderers, PiVehiclePresentationContract
 * -- are themselves natively defined in this file; moving this group without also moving those two
 * interfaces would just relocate the cycle risk rather than remove it.
 */
export interface RegisterVehicleToolsRenderingOptions {
	/**
	 * Per-operation renderCall/renderResult override. Returning undefined (or
	 * omitting this option entirely) falls back to the generic Vehicle
	 * renderer, which renders effect-colored call rows and a Table/ProgressBar/
	 * collapsible-JSON result view driven by the operation's own descriptor --
	 * see vehicle-render.ts. A consumer with real UX investment in one
	 * operation supplies its own pair here; every other operation still gets
	 * sensible default rendering instead of Pi's raw-JSON fallback.
	 *
	 * This is the HUMAN TUI channel only. The model-facing channel is a
	 * separate concern: see extractVehicleContent in vehicle-core -- an
	 * operation whose output carries its own `content` blocks gets those sent
	 * to the model instead of raw JSON, with no per-registration option needed
	 * here at all, since the operation itself is the only code that knows how
	 * to narrate what it computed.
	 */
	readonly renderers?: (descriptor: VehicleOperationDescriptor) => VehicleToolRenderers | undefined;
	/**
	 * Paired custom pre-persistence projector + renderer. Projection failures fail closed after the
	 * application invocation has succeeded: raw output is never substituted into persisted details.
	 * Omit this for the bounded generic vehicle.tool-details/v1 projector/renderer pair.
	 */
	readonly presentations?: (descriptor: VehicleOperationDescriptor) => PiVehiclePresentationContract | undefined;
	/** Human-selected glyph strategy for the generic renderer's progress bars. Geometry/math is unchanged. */
	readonly progressBarGlyphs?: ProgressBarGlyphs | ProgressBarGlyphStyle;
	/**
	 * Opt-in coverage audit: the real fix for a renderer-coverage gap silently degrading to
	 * raw JSON forever, discovered live (papyrus's tasks.mutation_status had no curated
	 * renderer, 15 of 41 tasks.* operations total). `operations` declares every operation name
	 * this Vehicle's own `renderers`/`presentations` factory genuinely curates (renders as
	 * something other than the generic Vehicle fallback) -- a static, explicit declaration
	 * rather than trying to shape-probe a renderer's own runtime behavior, which would be
	 * neither simple nor deterministic. Every manifest operation NOT in that set is reported
	 * once, at registration time, to onGap (defaulting to a console.warn naming the vehicle and
	 * every gap operation) -- turning a permanently invisible degradation into a visible signal
	 * the moment a new/renamed operation ships without a curated renderer. The improved generic
	 * fallback (vehicle-render.ts's recordEnvelope/multiArrayEnvelope) already renders many
	 * "uncovered" shapes reasonably -- this audit is about visibility into what's ACTUALLY still
	 * uncovered, not a claim that every gap is bad.
	 */
	readonly renderCoverage?: {
		readonly operations: readonly string[];
		readonly onGap?: (vehicleName: string, gaps: readonly string[]) => void;
	};
	/**
	 * A closed Registry/Strategy alternative to the generic renderer's own open shape-probing
	 * chain (vehicle-render.ts's singleArrayEnvelope/multiArrayEnvelope/recordEnvelope/... chain):
	 * keyed by descriptor.name, each entry gets first refusal on rendering that operation's own
	 * output, ahead of every generic shape guess. Unlike `renderers` (a full renderCall/renderResult
	 * override that replaces the generic renderer entirely, including its projected-presentation
	 * and partial-progress handling), a renderPresenters entry only customizes the final
	 * output-to-Component step -- everything else (error rendering, partial progress, the
	 * vehicle.tool-details/v1 projected-presentation path) still goes through the shared generic
	 * renderer unchanged. Returning undefined from a presenter falls through to the generic
	 * shape-probing chain, so a presenter never has to handle every possible shape its own
	 * operation could produce. The real value: build this map via `satisfies
	 * Record<YourOperationNameUnion, VehiclePresenter>` and the compiler itself rejects a
	 * manifest operation with no assigned presenter -- exhaustiveness renderCoverage's own runtime
	 * audit can only ever report on after the fact, never enforce ahead of time.
	 */
	readonly renderPresenters?: Readonly<Record<string, VehiclePresenter>>;
}

/**
 * Every field below is optional and additive: omitting it preserves pre-existing behavior
 * exactly, for every consumer that hasn't opted in. Each field's own comment documents the
 * real incident/gap it closes and what enabling it changes -- not what omitting it preserves,
 * since that's this one invariant, true of the whole interface, not worth restating per field.
 *
 * The `rendering`/`safety`/`approval`/`jobs` groups below are the current, preferred shape for
 * the option clusters each one covers -- each field they replace still works flat exactly as
 * before (`@deprecated` marks it, normalizeRegisterVehicleToolsOptions() merges both shapes
 * before anything reads `options` internally, grouped taking precedence when both are set for
 * the same underlying setting), so no existing consumer needs to migrate before upgrading.
 */
export interface RegisterVehicleToolsOptions {
	readonly permissions?: readonly string[];
	readonly principal?: VehiclePrincipal;
	readonly resolveInvocation?: PiVehicleInvocationResolver;
	/**
	 * Fires after a successful invoke(), before the tool result is returned -- for a
	 * consumer-local side effect the operation's own output has no way to carry (e.g. a
	 * same-process Pi extension event bus notification a sibling extension observes; a
	 * remote HTTP Vehicle consumer has no such bus, so this is deliberately host-local,
	 * not part of the operation's own transport-neutral contract). Never aborts the tool
	 * call: an error here is swallowed, matching the same "best-effort broadcast" contract
	 * a direct pi.events.emit() call would carry on its own.
	 */
	readonly onInvoked?: (request: PiVehicleInvocationRequest, output: unknown) => void | Promise<void>;
	readonly toolName?: (descriptor: VehicleOperationDescriptor, versioned: boolean) => string;
	readonly closeClientOnSessionShutdown?: boolean;
	/** @deprecated Use `rendering.renderers` instead -- see RegisterVehicleToolsRenderingOptions. */
	readonly renderers?: (descriptor: VehicleOperationDescriptor) => VehicleToolRenderers | undefined;
	/** @deprecated Use `rendering.presentations` instead -- see RegisterVehicleToolsRenderingOptions. */
	readonly presentations?: (descriptor: VehicleOperationDescriptor) => PiVehiclePresentationContract | undefined;
	/** Independent UTF-8 transcript budget. Defaults to 16 KiB; unrelated to transport and presentation-detail bounds. */
	readonly modelContentMaxBytes?: number;
	/** @deprecated Use `rendering.progressBarGlyphs` instead -- see RegisterVehicleToolsRenderingOptions. */
	readonly progressBarGlyphs?: ProgressBarGlyphs | ProgressBarGlyphStyle;
	/** @deprecated Use `rendering.renderCoverage` instead -- see RegisterVehicleToolsRenderingOptions. */
	readonly renderCoverage?: {
		readonly operations: readonly string[];
		readonly onGap?: (vehicleName: string, gaps: readonly string[]) => void;
	};
	/** @deprecated Use `rendering.renderPresenters` instead -- see RegisterVehicleToolsRenderingOptions. */
	readonly renderPresenters?: Readonly<Record<string, VehiclePresenter>>;
	/** Per-operation escape hatch for a client-local interactive step after a successful invoke() -- see PiVehicleInteractiveFollowUp. */
	readonly interactiveFollowUps?: (descriptor: VehicleOperationDescriptor) => PiVehicleInteractiveFollowUp | undefined;
	/**
	 * Per-operation override for Pi's own tool-call concurrency semantics -- e.g. "sequential" for
	 * an operation whose interactiveFollowUps prompts a human synchronously, so the model can't
	 * batch it alongside other tool calls and let those run before the human sees the prompt.
	 */
	readonly executionMode?: (descriptor: VehicleOperationDescriptor) => ToolExecutionMode | undefined;
	/** @deprecated Use `safety.requireApprovalForEffects` instead -- see RegisterVehicleToolsSafetyOptions (vehicle-safety.ts). */
	readonly requireApprovalForEffects?: readonly VehicleEffect[];
	/** @deprecated Use `safety.safetyPolicyStore` instead -- see RegisterVehicleToolsSafetyOptions (vehicle-safety.ts). */
	readonly safetyPolicyStore?: VehicleSafetyPolicyStore;
	/** @deprecated Use `approval.approvalPresentation` instead -- see RegisterVehicleToolsApprovalOptions (vehicle-local-approval.ts). */
	readonly approvalPresentation?: PiHitlPresentation;
	/** @deprecated Use `approval.approvalPrompt` instead -- see RegisterVehicleToolsApprovalOptions (vehicle-local-approval.ts). */
	readonly approvalPrompt?: (descriptor: VehicleOperationDescriptor, input: unknown) => { title: string; message: string } | undefined;
	/** @deprecated Use `approval.requestApproval` instead -- see RegisterVehicleToolsApprovalOptions (vehicle-local-approval.ts). */
	readonly requestApproval?: LocalApprovalRequester;
	/**
	 * Survives a restart/reload while the daemon is unreachable: a successful manifest() fetch is
	 * persisted here (atomic write, best-effort -- a failed write never fails registration); a
	 * failed factory-time fetch falls back to reading this file instead of throwing, so tool
	 * definitions and their renderers still exist for transcript replay of a historical tool call
	 * even while offline. Live availability (available/permissions) still only ever comes from a
	 * real manifest -- see RegisteredPiVehicle.stale and refreshVehicleToolAvailability, which
	 * callers should still wire to session_start (e.g. via registerVehicleStatusRefresh) to
	 * reconcile once the daemon is reachable again.
	 */
	readonly manifestCache?: { readonly filePath: string; readonly fs: AtomicJsonFsAdapter };
	/**
	 * Bounded retry/backoff around the initial manifest handshake -- the real-world gap this
	 * closes: a Pi extension's session_start calls registerVehicleTools() exactly once, and a
	 * daemon that is transiently unreachable at that exact moment (mid-restart from a
	 * legitimate version-check kill/respawn, or a package update swapping files out from under
	 * a live process) previously meant every Vehicle-projected tool was silently, permanently
	 * missing for the rest of that session -- no reload required to trigger it, and no reload
	 * could fix it either, since the next session_start would just race the same restart again
	 * if it was still in progress. Modeled on connectPushChannel's own jittered exponential
	 * backoff (min/max/growFactor, +/-20% jitter) and gRPC/Kubernetes-style bounded readiness
	 * probing: retry a few times over roughly half a second, then give up -- long enough to
	 * survive a real restart (observed ~100-300ms in production), short enough that a
	 * genuinely-down daemon still fails fast. Defaults to attempts:4, initialDelayMs:50,
	 * maxDelayMs:500, growFactor:2.5. Set attempts:1 to restore the old immediate-failure
	 * behavior exactly.
	 */
	readonly handshake?: RegisterVehicleToolsHandshakeOptions;
	/**
	 * Opt-in Vehicle Shell activation: instead of activating every available, permitted operation
	 * (this option's own default omission), registers two always-on meta-tools (tools_list,
	 * tools_man by default) and keeps most operations inactive behind a decaying-TTL cache -- see
	 * vehicle-shell.ts. Exists because a Vehicle with dozens of operations otherwise puts every
	 * single one's full schema in context from turn one, regardless of whether the session ever
	 * calls it.
	 */
	readonly shell?: VehicleShellOptions;
	/** @deprecated Use `jobs.jobPollIntervalMs` instead -- see RegisterVehicleToolsJobOptions (vehicle-job-polling.ts). */
	readonly jobPollIntervalMs?: number;
	/** Rendering/presentation options -- see RegisterVehicleToolsRenderingOptions above. */
	readonly rendering?: RegisterVehicleToolsRenderingOptions;
	/** Safety-classification options -- see RegisterVehicleToolsSafetyOptions (vehicle-safety.ts). */
	readonly safety?: RegisterVehicleToolsSafetyOptions;
	/** Local-approval-prompt options -- see RegisterVehicleToolsApprovalOptions (vehicle-local-approval.ts). */
	readonly approval?: RegisterVehicleToolsApprovalOptions;
	/** Vehicle Jobs polling options -- see RegisterVehicleToolsJobOptions (vehicle-job-polling.ts). */
	readonly jobs?: RegisterVehicleToolsJobOptions;
}

/**
 * Merges the `rendering`/`safety`/`approval`/`jobs` grouped option shapes onto
 * RegisterVehicleToolsOptions's own flat fields -- the single place both shapes are reconciled,
 * so every existing internal `options.xyz` read elsewhere in this file (and in
 * vehicle-safety-classification.ts, which also reads a few of them) keeps working completely
 * unchanged, whichever shape a caller actually supplied. Per-field precedence: the grouped value
 * wins when both are set for the same underlying setting, since the group is the newer, preferred
 * shape -- a caller migrating incrementally is assumed to be moving TOWARD the group, not away
 * from it. Called once at the top of every real entry point (registerVehicleTools,
 * refreshVehicleToolAvailability, buildInvocationContext) rather than at each of the ~11
 * individual read sites, so this reconciliation logic exists in exactly one place.
 */
/** Escape hatch for diagnosing/bypassing Vehicle Shell mode without a code change in every
 * consumer: set VEHICLE_SHELL_DISABLED=1 to force every registerVehicleTools() call in this
 * process to activate every operation directly (no tools_list/tools_man, no broker), regardless
 * of what options.shell the consumer itself passed. */
function isShellDisabledByEnv(): boolean {
	return process.env.VEHICLE_SHELL_DISABLED === "1";
}

function normalizeRegisterVehicleToolsOptions(options: RegisterVehicleToolsOptions): RegisterVehicleToolsOptions {
	if (!options.rendering && !options.safety && !options.approval && !options.jobs && !(isShellDisabledByEnv() && options.shell))
		return options;
	return {
		...options,
		...(isShellDisabledByEnv() ? { shell: undefined } : {}),
		renderers: options.rendering?.renderers ?? options.renderers,
		presentations: options.rendering?.presentations ?? options.presentations,
		progressBarGlyphs: options.rendering?.progressBarGlyphs ?? options.progressBarGlyphs,
		renderCoverage: options.rendering?.renderCoverage ?? options.renderCoverage,
		renderPresenters: options.rendering?.renderPresenters ?? options.renderPresenters,
		safetyPolicyStore: options.safety?.safetyPolicyStore ?? options.safetyPolicyStore,
		requireApprovalForEffects: options.safety?.requireApprovalForEffects ?? options.requireApprovalForEffects,
		approvalPresentation: options.approval?.approvalPresentation ?? options.approvalPresentation,
		approvalPrompt: options.approval?.approvalPrompt ?? options.approvalPrompt,
		requestApproval: options.approval?.requestApproval ?? options.requestApproval,
		jobPollIntervalMs: options.jobs?.jobPollIntervalMs ?? options.jobPollIntervalMs,
	};
}

export interface RegisteredPiVehicleTool {
	readonly toolName: string;
	readonly operationName: string;
	readonly operationVersion: number;
	/** This operation's availability as of the manifest fetch that produced this entry -- see refreshVehicleToolAvailability for keeping it current. */
	readonly available: boolean;
	/** Whether options.permissions, as of this registration/refresh, actually covers descriptor.permissions -- see permissionsSatisfied(). A tool is only ever active when both this and `available` are true. */
	readonly permissionsSatisfied: boolean;
	readonly effect: VehicleEffect;
	/** Resolved allow/ask/blocked -- see classifyVehicleOperationSafety(). A tool is only ever active when `available` is true and this isn't "blocked". */
	readonly safetyState: VehicleSafetyState;
}

export interface RegisteredPiVehicle {
	readonly manifest: VehicleManifest;
	readonly tools: readonly RegisteredPiVehicleTool[];
	/** True when `manifest` came from options.manifestCache's sidecar file rather than a live fetch -- the daemon was unreachable at registration/refresh time. A caller that cares (e.g. to show a reconnecting indicator) can check this; every existing caller ignoring it sees no behavior change. */
	readonly stale: boolean;
	/** Present only when options.shell was given -- pass this back into refreshVehicleToolAvailability so a later refresh keeps using the same TTL tracker instead of reactivating every available operation. */
	readonly shell?: VehicleShellHandle;
}

/** A fail-closed local projection error. The operation already succeeded; raw output is intentionally not persisted as fallback. */
export class PiVehiclePresentationProjectionError extends Error {
	constructor(operation: string, cause: unknown) {
		super(`Could not project bounded presentation details for ${operation}`, { cause });
		this.name = "PiVehiclePresentationProjectionError";
	}
}

export interface VehicleOperationInvocationParams {
	readonly client: VehicleClient;
	readonly manifest: VehicleManifest;
	readonly descriptor: VehicleOperationDescriptor;
	/** The name a consumer's own tool call is presented under -- purely for identity/telemetry; does not have to be descriptor's own projected Pi tool name (a consolidated multi-action tool passes its own single name for every sub-action it dispatches). */
	readonly toolName: string;
	readonly toolCallId: string;
	readonly input: unknown;
	readonly context: ExtensionContext;
	readonly signal?: AbortSignal;
	readonly onUpdate?: AgentToolUpdateCallback<PiVehicleToolDetails>;
	readonly options: RegisterVehicleToolsOptions;
	/** Internal resolved contract. Omitted preserves standalone/custom legacy {vehicle, output} behavior. */
	readonly presentationProjector?: PiVehiclePresentationProjector;
}

export interface VehicleOperationInvocationResult {
	readonly content: readonly VehicleContentBlock[];
	readonly details: PiVehicleToolDetails;
}

/**
 * The cross-cutting policy layer every registerVehicleTools()-registered tool
 * gets for free -- activity broadcasting, the local /safety "ask" gate, the
 * server approval-required retry dance, idempotency-key/correlationId
 * derivation, resolveInvocation/onInvoked/interactiveFollowUps hooks -- as a
 * standalone Decorator around a single operation call, independent of how
 * (or whether) that call is fronted by a Pi tool at all.
 *
 * Exists because registerVehicleTools()'s one-operation-to-one-tool
 * projection is a deliberate, correct default (Anthropic's own tool-design
 * guidance: consolidate related actions behind one tool with an action
 * parameter, rather than one tool per action) but is not the only legitimate
 * tool shape -- a consumer whose tool already consolidates several
 * operations behind an action/operation parameter (see e.g. web-spider's
 * web_category) cannot use registerVehicleTools() for that tool without
 * regressing its existing one-tool-many-actions contract into several
 * separate tools. Before this function existed, the only escape hatch was
 * calling client.invoke() directly, which silently forfeited every one of
 * the above cross-cutting behaviors -- exactly the gap this closes: a
 * consumer keeps full control of its own tool registration/schema/dispatch
 * shape while still calling through the same policy layer
 * registerVehicleTools() uses internally.
 */
/**
 * Shared state built once per invokeVehicleOperation() call and threaded through each of its
 * extracted steps below -- an Extract-Method decomposition, not a generic Decorator/middleware
 * pipeline: a real pipeline was considered and rejected because the approval-required retry step
 * (see invokeWithApprovalRetry) re-invokes the SAME core call with a mutated capability rather
 * than delegating to a distinct "next" step, which doesn't compose cleanly as a generic
 * (input, next) middleware signature, and only 5 concerns exist today, all added in-repo rather
 * than pluggable by a third party at runtime -- not enough to justify that generality yet.
 */
export interface InvocationContext {
	readonly params: VehicleOperationInvocationParams;
	readonly identity: PiVehicleIdentity;
	readonly request: PiVehicleInvocationRequest;
	readonly baseInvocation: VehicleInvocationOptions;
	readonly jobPollIntervalMs: number;
	readonly presentationProjector: PiVehiclePresentationProjector | undefined;
}

export async function buildInvocationContext(rawParams: VehicleOperationInvocationParams): Promise<InvocationContext> {
	const params: VehicleOperationInvocationParams = { ...rawParams, options: normalizeRegisterVehicleToolsOptions(rawParams.options) };
	const { manifest, descriptor, toolName, toolCallId, input, context, signal, onUpdate, options } = params;
	const presentationProjector = params.presentationProjector ?? options.presentations?.(descriptor)?.projector;
	const identity = vehicleIdentity(manifest, descriptor, toolCallId);
	const request: PiVehicleInvocationRequest = { descriptor, manifest, toolName, toolCallId, input, context, signal, onUpdate };
	const resolved = await options.resolveInvocation?.(request);

	const reportProgress: VehicleInvocationOptions["onProgress"] = (progress) => {
		let presentation: JsonValue | undefined;
		if (presentationProjector?.projectProgress) {
			try {
				presentation = presentationProjector.projectProgress(progress, request);
				assertJsonSafePresentation(presentation, presentationProjector.maxBytes);
			} catch {
				return;
			}
		}
		onUpdate?.({
			content: [...boundVehicleModelContent([{ type: "text", text: formatJson(progress) }], options.modelContentMaxBytes)],
			details: presentation === undefined ? { vehicle: identity, progress } : { vehicle: identity, presentation },
		});
	};
	const baseInvocation: VehicleInvocationOptions = {
		permissions: options.permissions,
		principal: options.principal,
		...resolved,
		operationId: toolCallId,
		correlationId: resolved?.correlationId ?? context.sessionManager.getSessionId(),
		// See VehicleInvocationOptions's own doc comment (vehicle-core) -- a generic ownership hook
		// distinct from correlationId/principal above, auto-derived from this real call's own
		// session/cwd so a handler (e.g. a background subscription) can attribute itself to the
		// exact Pi session/project that created it, without every consumer re-deriving this itself.
		callerSessionId: resolved?.callerSessionId ?? context.sessionManager.getSessionId(),
		callerProjectRoot: resolved?.callerProjectRoot ?? context.cwd,
		signal,
		onProgress: reportProgress,
		...(descriptor.idempotency.mode === "keyed" && !resolved?.idempotencyKey ? { idempotencyKey: toolCallId } : {}),
	};
	return {
		params,
		identity,
		request,
		baseInvocation,
		jobPollIntervalMs: options.jobPollIntervalMs ?? DEFAULT_JOB_POLL_INTERVAL_MS,
		presentationProjector,
	};
}

// A human's own /safety override, not the effect-level default (that case is already covered by
// the approval-required round trip in invokeWithApprovalRetry below) -- a client-only gate, never
// touches invoke() at all on denial, so no server capability is needed for an effect the server
// itself never gates.
export async function applyLocalSafetyGate(ctx: InvocationContext): Promise<void> {
	const { manifest, descriptor, input, context, signal, options } = ctx.params;
	if (options.safetyPolicyStore?.get(manifest.name, descriptor.name) !== "ask") return;
	const answer = await requestLocalApproval(
		context,
		descriptor,
		input,
		signal,
		options.approvalPresentation,
		options.approvalPrompt?.(descriptor, input),
		options.requestApproval,
	);
	if (answer?.approved) return;
	const failure: VehicleFailure = {
		code: "vehicle-safety-denied",
		category: "authorization",
		message: `${operationKey(descriptor)} was denied by the local /safety policy`,
		retryable: true,
	};
	publishOperationActivity("failed", ctx.identity, descriptor, { code: failure.code });
	throw new PiVehicleInvocationError(failure, manifest.name);
}

// Owns the whole approval-required catch/resolve/retry dance around the core invokeOrRunAsJob
// call -- the registry (once configureApprovals() is enabled there) records a durable
// approval.requested event before ever failing this way, so a caller always has a path forward
// via vehicle.approval.resolve; this is just the optional local fast path attempting it
// automatically.
export async function invokeWithApprovalRetry(ctx: InvocationContext): Promise<unknown> {
	const { client, manifest, descriptor, input, context, signal, options } = ctx.params;
	try {
		return await invokeOrRunAsJob(client, descriptor, input, ctx.baseInvocation, ctx.jobPollIntervalMs);
	} catch (error) {
		const failure = sanitizedFailure(error, descriptor.idempotency.mode);
		if (failure.code !== "approval-required") {
			publishOperationActivity("failed", ctx.identity, descriptor, { code: failure.code });
			throw new PiVehicleInvocationError(failure, manifest.name);
		}
		const requestId = approvalRequestId(failure);
		// No requestId to act on, or no UI capable of asking -- the request
		// stays durably pending (an async/remote approver can still resolve it
		// later) rather than this call eagerly denying it on the caller's behalf.
		if (!requestId || !context.hasUI) {
			publishOperationActivity("failed", ctx.identity, descriptor, { code: failure.code });
			throw new PiVehicleInvocationError(failure, manifest.name);
		}

		const answer = await requestLocalApproval(
			context,
			descriptor,
			input,
			signal,
			options.approvalPresentation,
			options.approvalPrompt?.(descriptor, input),
			options.requestApproval,
		);
		const approved = answer?.approved === true;
		let capability: string | undefined;
		try {
			const resolveOutput = (await client.invoke(
				VEHICLE_APPROVAL_RESOLVE_OPERATION_NAME,
				1,
				{ requestId, decision: approved ? "granted" : "denied", ...(answer?.comment ? { comment: answer.comment } : {}) },
				{ permissions: options.permissions, principal: options.principal, signal },
			)) as { capability?: string };
			capability = resolveOutput.capability;
		} catch {
			// The resolve round trip itself failed (missing permission, expired
			// request) -- fall through to the original approval-required failure,
			// never mint or assume a capability that was never actually granted.
		}
		if (!capability) {
			publishOperationActivity("failed", ctx.identity, descriptor, { code: failure.code });
			throw new PiVehicleInvocationError(failure, manifest.name);
		}
		try {
			return await invokeOrRunAsJob(
				client,
				descriptor,
				input,
				{ ...ctx.baseInvocation, approvalCapability: capability },
				ctx.jobPollIntervalMs,
			);
		} catch (retryError) {
			const retryFailure = sanitizedFailure(retryError, descriptor.idempotency.mode);
			publishOperationActivity("failed", ctx.identity, descriptor, { code: retryFailure.code });
			throw new PiVehicleInvocationError(retryFailure, manifest.name);
		}
	}
}

// Best-effort: the invoke() itself already succeeded, so a broadcast failure must never surface
// as a failed tool call.
async function runOnInvokedHook(ctx: InvocationContext, output: unknown): Promise<void> {
	const { descriptor, manifest, toolName, toolCallId, input, context, options } = ctx.params;
	if (!options.onInvoked) return;
	try {
		await options.onInvoked({ descriptor, manifest, toolName, toolCallId, input, context }, output);
	} catch {
		// see comment above
	}
}

async function runInteractiveFollowUp(
	ctx: InvocationContext,
	output: unknown,
): Promise<{ content: readonly VehicleContentBlock[]; presentationOutput: unknown }> {
	const { client, descriptor, options } = ctx.params;
	let presentationOutput = output;
	let content: readonly VehicleContentBlock[] | undefined;
	const followUp = options.interactiveFollowUps?.(descriptor);
	if (followUp) {
		const result = await followUp(ctx.request, output, client);
		if (result) {
			presentationOutput = result.output ?? output;
			content = boundVehicleModelContent(result.content, options.modelContentMaxBytes);
		}
	}
	content ??= modelContentFor(output, options.modelContentMaxBytes);
	return { content, presentationOutput };
}

async function projectPresentation(
	ctx: InvocationContext,
	presentationOutput: unknown,
	content: readonly VehicleContentBlock[],
): Promise<VehicleOperationInvocationResult> {
	if (!ctx.presentationProjector) {
		return { content: [...content], details: { vehicle: ctx.identity, output: presentationOutput } };
	}
	let presentation: JsonValue;
	try {
		presentation = await ctx.presentationProjector.project(presentationOutput, ctx.request);
		assertJsonSafePresentation(presentation, ctx.presentationProjector.maxBytes);
	} catch (cause) {
		throw new PiVehiclePresentationProjectionError(operationKey(ctx.params.descriptor), cause);
	}
	return { content: [...content], details: { vehicle: ctx.identity, presentation } };
}

export async function invokeVehicleOperation(params: VehicleOperationInvocationParams): Promise<VehicleOperationInvocationResult> {
	const ctx = await buildInvocationContext(params);
	publishOperationActivity("started", ctx.identity, params.descriptor);
	await applyLocalSafetyGate(ctx);
	const output = await invokeWithApprovalRetry(ctx);
	publishOperationActivity("completed", ctx.identity, params.descriptor);
	await runOnInvokedHook(ctx, output);
	const { content, presentationOutput } = await runInteractiveFollowUp(ctx, output);
	return projectPresentation(ctx, presentationOutput, content);
}

/**
 * Projects a `VehicleClient`'s manifest into native Pi tools,
 * preserving exact operation versions, schemas, cancellation, Pi
 * call/session identity, explicit permissions and principals, keyed
 * idempotency, progress, and structured failures.
 *
 * A currently-unavailable operation (per the manifest's `available` flag),
 * or one whose declared `permissions` aren't fully covered by this
 * registration's own `options.permissions` (the exact superset check
 * `VehicleRegistry.invoke()` already enforces at call time, applied here to
 * visibility instead), is still registered as a Pi tool -- Pi has no
 * `unregisterTool()` -- but curated out of the LLM's active/callable set
 * from this very first call, via the Vehicle-agnostic `syncManagedActiveTools`
 * primitive. A caller never sees a tool it has no permissions to call in
 * the first place.
 *
 * Registers definitions immediately; only active-tool synchronization is
 * deferred to `session_start`, since Pi action methods aren't available
 * during extension loading.
 *
 * @example
 * ```ts
 * import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
 * import { registerVehicleTools } from "@danypops/vehicle-client-pi";
 *
 * export default async function (pi: ExtensionAPI) {
 *   await registerVehicleTools(pi, client, {
 *     permissions: ["issues:read"],
 *     principal: { id: "pi-extension" },
 *     closeClientOnSessionShutdown: true,
 *   });
 * }
 * ```
 */

export async function registerVehicleTools(
	pi: ExtensionAPI,
	client: VehicleClient,
	rawOptions: RegisterVehicleToolsOptions = {},
): Promise<RegisteredPiVehicle> {
	const options = normalizeRegisterVehicleToolsOptions(rawOptions);
	const { manifest, stale } = await resolveManifestForRegistration(client, options.manifestCache, options.handshake);
	const toolDeps = { invoke: invokeVehicleOperation };
	registerInProcessVehicle(
		manifest.name,
		manifest,
		client,
		buildOperationActivator(toolDeps, pi, manifest.name, client, manifest, options),
	);
	const projected = projectedNames(manifest, options.toolName ?? defaultToolName);
	const runtime = tryExtensionRuntimeAction(() => pi.getAllTools());
	assertNamesAvailable(projected, runtime.status === "ready" ? runtime.value.map((tool) => tool.name) : []);
	reportRenderCoverageGaps(manifest, options.renderCoverage);

	for (const { descriptor, toolName } of projected) {
		pi.registerTool(createTool(toolDeps, client, manifest, descriptor, toolName, options));
	}
	if (options.closeClientOnSessionShutdown) {
		pi.on("session_shutdown", async () => {
			await client.close();
		});
	}

	const tools = projected.map(({ descriptor, toolName }) => ({
		toolName,
		operationName: descriptor.name,
		operationVersion: descriptor.version,
		available: descriptor.available,
		permissionsSatisfied: permissionsSatisfied(descriptor.permissions, options.permissions),
		effect: descriptor.effect,
		safetyState: resolveSafetyState(manifest.name, descriptor, options),
	}));
	const shell = registerVehicleShell(pi, manifest.name, shellManagedTools(manifest.name, tools), options.shell);
	// Registered tools whose operation is currently unavailable (e.g. a
	// missing credential) or currently resolved to "blocked" (missing
	// permissions, or an explicit /safety override) are hidden from the LLM
	// from the very first registration -- registering them at all (rather
	// than skipping) keeps them ready to flip active later via
	// refreshVehicleToolAvailability, since Pi has no unregisterTool() to add
	// them back with afterward. During extension loading, definitions can be
	// registered but Pi's active-tool action methods are not ready yet; defer
	// only availability sync so renderers exist before transcript replay.
	const syncAvailability = () =>
		shell
			? applyVehicleShellActivation(pi, shell)
			: syncManagedActiveTools(
					pi,
					tools.map((tool) => tool.toolName),
					tools.filter((tool) => tool.available && tool.safetyState !== "blocked").map((tool) => tool.toolName),
				);
	if (runtime.status === "ready") {
		syncAvailability();
	} else {
		pi.on("session_start", syncAvailability);
	}
	contributeToSafetyRegistry(manifest, tools);

	return { manifest, tools, stale, ...(shell ? { shell } : {}) };
}

/**
 * Re-fetches the manifest and re-syncs which of this Vehicle's Pi tools are
 * currently active, without ever re-registering a tool this call has
 * already seen (Pi has no way to re-register under the same name). Any
 * operation present in the fresh manifest but not in `registered` is a
 * genuinely new operation and gets registered for the first time; every
 * previously-known tool just has its active/inactive state re-synced
 * against the operation's current `available` flag.
 *
 * Callers decide their own refresh cadence (a maintenance-task-style
 * interval, a push notification, a session_start recheck); this function
 * only does one refresh pass and returns the updated bookkeeping to pass
 * into the next call.
 */
export async function refreshVehicleToolAvailability(
	pi: ExtensionAPI,
	client: VehicleClient,
	registered: RegisteredPiVehicle,
	rawOptions: RegisterVehicleToolsOptions = {},
): Promise<RegisteredPiVehicle> {
	const options = normalizeRegisterVehicleToolsOptions(rawOptions);
	const manifest = await client.manifest();
	await persistManifestCache(options.manifestCache, manifest);
	const projected = projectedNames(manifest, options.toolName ?? defaultToolName);
	const known = new Set(registered.tools.map((tool) => operationKey({ name: tool.operationName, version: tool.operationVersion })));

	const newlyProjected = projected.filter(({ descriptor }) => !known.has(operationKey(descriptor)));
	if (newlyProjected.length > 0) {
		assertNamesAvailable(
			newlyProjected,
			guardExtensionRuntimeInitialized(() => pi.getAllTools()).map((tool) => tool.name),
		);
	}

	const tools: RegisteredPiVehicleTool[] = [];
	for (const { descriptor, toolName } of projected) {
		if (!known.has(operationKey(descriptor))) {
			pi.registerTool(createTool({ invoke: invokeVehicleOperation }, client, manifest, descriptor, toolName, options));
		}
		tools.push({
			toolName,
			operationName: descriptor.name,
			operationVersion: descriptor.version,
			available: descriptor.available,
			permissionsSatisfied: permissionsSatisfied(descriptor.permissions, options.permissions),
			effect: descriptor.effect,
			safetyState: resolveSafetyState(manifest.name, descriptor, options),
		});
	}

	if (registered.shell) {
		refreshVehicleShellManagedTools(registered.shell, shellManagedTools(manifest.name, tools));
		applyVehicleShellActivation(pi, registered.shell);
	} else {
		syncManagedActiveTools(
			pi,
			tools.map((tool) => tool.toolName),
			tools.filter((tool) => tool.available && tool.safetyState !== "blocked").map((tool) => tool.toolName),
		);
	}
	contributeToSafetyRegistry(manifest, tools);

	return { manifest, tools, stale: false, ...(registered.shell ? { shell: registered.shell } : {}) };
}

/** Thin re-export wrapper -- see vehicle-pi/ready-retry.ts's own doc comment. Injects this
 * module's own registerVehicleTools as the one real (non-type) coupling ready-retry.ts needs
 * back here, avoiding an import cycle. */
export function registerVehicleToolsWhenReady(
	pi: ExtensionAPI,
	resolveClient: () => Promise<VehicleClient | undefined>,
	options: RegisterVehicleToolsWhenReadyOptions = {},
): Promise<RegisteredPiVehicle | undefined> {
	return registerVehicleToolsWhenReadyImpl({ registerVehicleTools }, pi, resolveClient, options);
}
