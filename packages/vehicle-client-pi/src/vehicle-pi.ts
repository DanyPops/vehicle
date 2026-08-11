import type {
	AtomicJsonFsAdapter,
	JsonValue,
	VehicleClient,
	VehicleContentBlock,
	VehicleEffect,
	VehicleFailure,
	VehicleInvocationOptions,
	VehicleManifest,
	VehicleManifestOperation,
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
import { DEFAULT_JOB_POLL_INTERVAL_MS, invokeOrRunAsJob } from "./vehicle-job-polling.js";
import { type LocalApprovalRequester, requestLocalApproval } from "./vehicle-local-approval.js";
import {
	persistManifestCache,
	type RegisterVehicleToolsHandshakeOptions,
	resolveManifestForRegistration,
} from "./vehicle-manifest-handshake.js";
import {
	boundVehicleModelContent,
	defaultToolName,
	displayLabel,
	formatJson,
	modelContentFor,
	operationKey,
	permissionsSatisfied,
	publishOperationActivity,
	sleep,
	vehicleIdentity,
} from "./vehicle-pi-primitives.js";
import { renderVehicleCall, renderVehicleResult, type VehiclePresenter } from "./vehicle-render.js";
import {
	assertJsonSafePresentation,
	DEFAULT_PRESENTATION_MAX_BYTES,
	projectGenericVehiclePresentation,
	projectGenericVehicleProgress,
} from "./vehicle-render-model.js";
import type { VehicleSafetyPolicyStore, VehicleSafetyState } from "./vehicle-safety.js";
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
import type { DiscoveredVehicle } from "./vehicle-shell-broker.js";

export type { LocalApprovalPrompt, LocalApprovalRequester, LocalApprovalRequestParams } from "./vehicle-local-approval.js";
export type { RegisterVehicleToolsHandshakeOptions } from "./vehicle-manifest-handshake.js";
export {
	boundVehicleModelContent,
	DEFAULT_MODEL_CONTENT_MAX_BYTES,
} from "./vehicle-pi-primitives.js";
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
	/** Independent UTF-8 transcript budget. Defaults to 16 KiB; unrelated to transport and presentation-detail bounds. */
	readonly modelContentMaxBytes?: number;
	/** Human-selected glyph strategy for the generic renderer's progress bars. Geometry/math is unchanged. */
	readonly progressBarGlyphs?: ProgressBarGlyphs | ProgressBarGlyphStyle;
	/**
	 * Per-operation escape hatch for a client-local interactive step after a
	 * successful invoke() -- see PiVehicleInteractiveFollowUp. Returning
	 * undefined (or omitting this option, or the resolver itself returning
	 * undefined for a given descriptor) means every operation behaves exactly
	 * as before this option existed: default content/details from the
	 * primary output, no extra round trip.
	 */
	readonly interactiveFollowUps?: (descriptor: VehicleOperationDescriptor) => PiVehicleInteractiveFollowUp | undefined;
	/**
	 * Per-operation override for Pi's own tool-call concurrency semantics --
	 * e.g. "sequential" for an operation whose interactiveFollowUps prompts a
	 * human synchronously, so the model can't batch it alongside other tool
	 * calls and let those run before the human sees the prompt. Undefined (the
	 * default for every operation) means Pi's own default concurrency mode,
	 * unchanged from today.
	 */
	readonly executionMode?: (descriptor: VehicleOperationDescriptor) => ToolExecutionMode | undefined;
	/**
	 * Mirrors the server's own VehicleRegistry.configureApprovals()
	 * requireApprovalForEffects set (see vehicle-server) so /safety's "ask"
	 * classification matches reality -- purely advisory here: the server
	 * enforces its own copy regardless of what this option says. Defaults to
	 * DEFAULT_APPROVAL_EFFECTS, the same default the server itself uses.
	 */
	readonly requireApprovalForEffects?: readonly VehicleEffect[];
	/**
	 * A human's own /safety overrides, consulted ahead of the effect-level
	 * default and the permission-based check for both tool visibility (see
	 * syncManagedActiveTools below) and the local pre-invoke approval gate
	 * (see createTool's execute()). Omitted means no overrides exist --
	 * classification falls back to permissions+effect exactly as before this
	 * option existed, a zero-behavior-change default.
	 */
	readonly safetyPolicyStore?: VehicleSafetyPolicyStore;
	/**
	 * Host used for local approval HITL. `overlay` (default) blocks in a popup over
	 * scrollback; `integrated` replaces Pi's editor while preserving its draft,
	 * scrollback, and footer. RPC/headless contexts retain the native confirm fallback.
	 */
	readonly approvalPresentation?: PiHitlPresentation;
	/**
	 * Per-operation override for the local approval prompt's own title/message, shown by the
	 * approval-required retry dance's optional synchronous fast path (requestLocalApproval)
	 * and by the local /safety "ask" gate. Returning undefined (or omitting this option
	 * entirely, or the callback returning undefined for a given descriptor) falls back to
	 * the generic `Approve ${displayLabel}?` / raw-JSON-input prompt, unchanged.
	 *
	 * Exists for the same reason `renderers` exists for tool call/result rendering: a
	 * consumer with real UX investment in one operation's approval copy (e.g. a
	 * human-readable command preview, or a specific warning that applies only to one
	 * dangerous input shape) can supply it here instead of every caller seeing a raw JSON
	 * dump of the input. Does not change the server-side approval-required/capability
	 * protocol at all -- purely the local prompt's own copy.
	 */
	readonly approvalPrompt?: (descriptor: VehicleOperationDescriptor, input: unknown) => { title: string; message: string } | undefined;
	/**
	 * Overrides the actual local-approval HITL mechanism itself -- distinct from approvalPrompt
	 * above, which only ever customizes the plain yes/no prompt's title/message text. See
	 * LocalApprovalRequester's own doc comment. Omitted (the default) preserves today's
	 * requestPiApproval-based prompt exactly.
	 */
	readonly requestApproval?: LocalApprovalRequester;
	/**
	 * Survives a restart/reload while the daemon is unreachable: a successful
	 * manifest() fetch is persisted here (atomic write, best-effort -- a failed
	 * write never fails registration); a failed factory-time fetch falls back
	 * to reading this file instead of throwing, so tool definitions and their
	 * renderers still exist for transcript replay of a historical tool call
	 * even while offline. Live availability (available/permissions) still only
	 * ever comes from a real manifest -- see RegisteredPiVehicle.stale and
	 * refreshVehicleToolAvailability, which callers should still wire to
	 * session_start (e.g. via registerVehicleStatusRefresh) to reconcile once
	 * the daemon is reachable again. Omitted (the default) preserves today's
	 * behavior: a factory-time manifest() failure throws.
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
	 * calls it. Omitted (the default) preserves today's all-active behavior exactly, for every
	 * existing consumer that hasn't opted in.
	 */
	readonly shell?: VehicleShellOptions;
	/**
	 * How often invokeVehicleOperation polls a background-capable operation's Vehicle Job
	 * (tailJob + pollJob) while it's still running -- unrelated to the tool call's own
	 * unchanged single-call surface (see the module doc comment above runVehicleJobToCompletion).
	 * Defaults to 500ms. Only ever consulted for an operation whose descriptor declares
	 * `background` AND whose client exposes submitJob -- every other operation is invoked exactly
	 * as before, one live client.invoke() call, this option never read.
	 */
	readonly jobPollIntervalMs?: number;
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
	 * the moment a new/renamed operation ships without a curated renderer. Omitted (the default)
	 * runs no audit at all -- zero behavior change for every existing consumer that hasn't
	 * opted in. The improved generic fallback (vehicle-render.ts's recordEnvelope/
	 * multiArrayEnvelope) already renders many "uncovered" shapes reasonably -- this audit is
	 * about visibility into what's ACTUALLY still uncovered, not a claim that every gap is bad.
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
	 * audit can only ever report on after the fact, never enforce ahead of time. Omitted (the
	 * default) preserves today's generic-chain-only behavior exactly, for every existing consumer.
	 */
	readonly renderPresenters?: Readonly<Record<string, VehiclePresenter>>;
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

/**
 * Never projects VEHICLE_APPROVAL_RESOLVE_OPERATION_NAME as a Pi tool, even
 * when it's present in the manifest (any registry with configureApprovals()
 * enabled registers it) and the caller's own options.permissions happens to
 * cover its required permission. It is invoked exactly one way in this
 * package -- client.invoke() from inside the approval-required retry dance
 * below, using options.permissions the extension author fixed at
 * registration time -- never as a tool call a model can choose to make.
 * Exposing it as a model-callable tool would let a model grant its own
 * pending approval requests, defeating the human-in-the-loop point of the
 * gate entirely.
 */
function projectedNames(
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

function assertNamesAvailable(
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
export async function invokeVehicleOperation(params: VehicleOperationInvocationParams): Promise<VehicleOperationInvocationResult> {
	const { client, manifest, descriptor, toolName, toolCallId, input, context, signal, onUpdate, options } = params;
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

	publishOperationActivity("started", identity, descriptor);

	// A human's own /safety override, not the effect-level default (that
	// case is already covered by the approval-required round trip below) --
	// a client-only gate, never touches invoke() at all on denial, so no
	// server capability is needed for an effect the server itself never
	// gates.
	if (options.safetyPolicyStore?.get(manifest.name, descriptor.name) === "ask") {
		const answer = await requestLocalApproval(
			context,
			descriptor,
			input,
			signal,
			options.approvalPresentation,
			options.approvalPrompt?.(descriptor, input),
			options.requestApproval,
		);
		if (!answer?.approved) {
			const failure: VehicleFailure = {
				code: "vehicle-safety-denied",
				category: "authorization",
				message: `${operationKey(descriptor)} was denied by the local /safety policy`,
				retryable: true,
			};
			publishOperationActivity("failed", identity, descriptor, { code: failure.code });
			throw new PiVehicleInvocationError(failure, manifest.name);
		}
	}

	const jobPollIntervalMs = options.jobPollIntervalMs ?? DEFAULT_JOB_POLL_INTERVAL_MS;
	let output: unknown;
	try {
		output = await invokeOrRunAsJob(client, descriptor, input, baseInvocation, jobPollIntervalMs);
	} catch (error) {
		const failure = sanitizedFailure(error, descriptor.idempotency.mode);
		// The registry (once configureApprovals() is enabled there) records a
		// durable approval.requested event before ever failing this way -- a
		// caller always has a path forward via vehicle.approval.resolve, this
		// is just the optional local fast path attempting it automatically.
		if (failure.code !== "approval-required") {
			publishOperationActivity("failed", identity, descriptor, { code: failure.code });
			throw new PiVehicleInvocationError(failure, manifest.name);
		}
		const requestId = approvalRequestId(failure);
		// No requestId to act on, or no UI capable of asking -- the request
		// stays durably pending (an async/remote approver can still resolve it
		// later) rather than this call eagerly denying it on the caller's behalf.
		if (!requestId || !context.hasUI) {
			publishOperationActivity("failed", identity, descriptor, { code: failure.code });
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
			publishOperationActivity("failed", identity, descriptor, { code: failure.code });
			throw new PiVehicleInvocationError(failure, manifest.name);
		}
		try {
			output = await invokeOrRunAsJob(client, descriptor, input, { ...baseInvocation, approvalCapability: capability }, jobPollIntervalMs);
		} catch (retryError) {
			const retryFailure = sanitizedFailure(retryError, descriptor.idempotency.mode);
			publishOperationActivity("failed", identity, descriptor, { code: retryFailure.code });
			throw new PiVehicleInvocationError(retryFailure, manifest.name);
		}
	}
	publishOperationActivity("completed", identity, descriptor);
	if (options.onInvoked) {
		try {
			await options.onInvoked({ descriptor, manifest, toolName, toolCallId, input, context }, output);
		} catch {
			// Best-effort: the invoke() itself already succeeded, so a broadcast failure
			// must never surface as a failed tool call.
		}
	}
	let presentationOutput = output;
	let content: readonly VehicleContentBlock[] | undefined;
	const followUp = options.interactiveFollowUps?.(descriptor);
	if (followUp) {
		const result = await followUp(request, output, client);
		if (result) {
			presentationOutput = result.output ?? output;
			content = boundVehicleModelContent(result.content, options.modelContentMaxBytes);
		}
	}
	content ??= modelContentFor(output, options.modelContentMaxBytes);
	if (!presentationProjector) {
		return { content: [...content], details: { vehicle: identity, output: presentationOutput } };
	}

	let presentation: JsonValue;
	try {
		presentation = await presentationProjector.project(presentationOutput, request);
		assertJsonSafePresentation(presentation, presentationProjector.maxBytes);
	} catch (cause) {
		throw new PiVehiclePresentationProjectionError(operationKey(descriptor), cause);
	}
	return { content: [...content], details: { vehicle: identity, presentation } };
}

const GENERIC_PRESENTATION_PROJECTOR: PiVehiclePresentationProjector = Object.freeze({
	maxBytes: DEFAULT_PRESENTATION_MAX_BYTES,
	project: (output: unknown) => projectGenericVehiclePresentation(output, DEFAULT_PRESENTATION_MAX_BYTES) as unknown as JsonValue,
	projectProgress: (progress: unknown) => projectGenericVehicleProgress(progress, DEFAULT_PRESENTATION_MAX_BYTES) as unknown as JsonValue,
});

function createTool(
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
			const result = await invokeVehicleOperation({
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
 * The Vehicle Shell broker mode's own default activateForeignOperation implementation: the exact
 * same createTool() every native operation gets, just pointed at a foreign vehicle's own client
 * and manifest -- so a dynamically-activated foreign operation carries every cross-cutting
 * guarantee (permissions, safety, presentations, activity broadcasting, keyed idempotency,
 * structured failures) a locally-registered operation gets, never a second-class code path.
 *
 * Tool name is namespaced by vehicle name up front (e.g. "packed_package_install") specifically
 * so two different foreign vehicles can never collide with each other on a shared operation name;
 * within one vehicle's own operations, defaultToolName's own uniqueness already holds. Still
 * guards against every other kind of collision (a foreign vehicle whose own name collides with an
 * already-registered local tool, or the rare case of two distinct operations sanitizing to the
 * same name) via the same assertNamesAvailable check static registration already uses, surfacing
 * a clear error tools_man turns into a friendly non-crashing message rather than silently
 * overwriting an existing tool.
 */
function activateForeignVehicleOperation(
	pi: ExtensionAPI,
	vehicle: DiscoveredVehicle,
	descriptor: VehicleManifestOperation,
	options: RegisterVehicleToolsOptions,
): string {
	const toolName = `${defaultToolName({ ...descriptor, name: vehicle.name }, false)}_${defaultToolName(descriptor, false)}`;
	const runtime = tryExtensionRuntimeAction(() => pi.getAllTools());
	assertNamesAvailable([{ descriptor, toolName }], runtime.status === "ready" ? runtime.value.map((tool) => tool.name) : []);
	pi.registerTool(createTool(vehicle.client, vehicle.manifest, descriptor, toolName, options));
	return toolName;
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

/** Default onGap: one console.warn line naming the vehicle and every gap operation, so an
 * un-audited operation is at minimum visible in whatever logs this process already writes
 * to, without requiring a consumer to supply its own logger just to see anything at all. */
function defaultRenderCoverageGapLogger(vehicleName: string, gaps: readonly string[]): void {
	console.warn(`[${vehicleName}] operation(s) with no curated renderer (falls back to the generic Vehicle fallback): ${gaps.join(", ")}`);
}

/** Never throws -- a coverage audit is a diagnostic, not a gate; a bug in the audit itself
 * must never prevent real registration from completing. */
function reportRenderCoverageGaps(manifest: VehicleManifest, renderCoverage: RegisterVehicleToolsOptions["renderCoverage"]): void {
	if (!renderCoverage) return;
	try {
		const covered = new Set(renderCoverage.operations);
		const gaps = manifest.operations.map((operation) => operation.name).filter((name) => !covered.has(name));
		if (gaps.length > 0) (renderCoverage.onGap ?? defaultRenderCoverageGapLogger)(manifest.name, gaps);
	} catch {
		// A broken audit must never break real tool registration.
	}
}

export async function registerVehicleTools(
	pi: ExtensionAPI,
	client: VehicleClient,
	options: RegisterVehicleToolsOptions = {},
): Promise<RegisteredPiVehicle> {
	const { manifest, stale } = await resolveManifestForRegistration(client, options.manifestCache, options.handshake);
	const projected = projectedNames(manifest, options.toolName ?? defaultToolName);
	const runtime = tryExtensionRuntimeAction(() => pi.getAllTools());
	assertNamesAvailable(projected, runtime.status === "ready" ? runtime.value.map((tool) => tool.name) : []);
	reportRenderCoverageGaps(manifest, options.renderCoverage);

	for (const { descriptor, toolName } of projected) {
		pi.registerTool(createTool(client, manifest, descriptor, toolName, options));
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
	const shell = registerVehicleShell(pi, manifest, shellManagedTools(tools), withBrokerRouting(pi, options));
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

/** RegisteredPiVehicleTool's own available/blocked facts, narrowed to what vehicle-shell.ts needs -- keeps that file from importing this one's own (much larger) type. */
function shellManagedTools(tools: readonly RegisteredPiVehicleTool[]) {
	return tools.map((tool) => ({
		toolName: tool.toolName,
		operationName: tool.operationName,
		available: tool.available,
		blocked: tool.safetyState === "blocked",
	}));
}

/** Auto-supplies broker mode's real routing hook (activateForeignVehicleOperation) whenever a
 * consumer opts into options.shell.broker without already supplying its own -- the only reason
 * this file passes anything other than options.shell straight through to registerVehicleShell.
 * Returns options.shell completely unmodified in every other case, including no shell at all. */
function withBrokerRouting(pi: ExtensionAPI, options: RegisterVehicleToolsOptions): VehicleShellOptions | undefined {
	if (!options.shell?.broker || options.shell.broker.activateForeignOperation) return options.shell;
	return {
		...options.shell,
		broker: {
			...options.shell.broker,
			activateForeignOperation: (vehicle, descriptor) => activateForeignVehicleOperation(pi, vehicle, descriptor, options),
		},
	};
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
	options: RegisterVehicleToolsOptions = {},
): Promise<RegisteredPiVehicle> {
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
			pi.registerTool(createTool(client, manifest, descriptor, toolName, options));
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
		refreshVehicleShellManagedTools(registered.shell, shellManagedTools(tools));
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

/**
 * One attempt's outcome, reported through `log` instead of the silent
 * return/bare-catch every consumer independently reimplemented (pi-tickets'
 * registerTicketsVehicle, pi-papyrus's registerNotesVehicle): `resolveClient`
 * returning undefined (no daemon target resolvable yet), `resolveClient`
 * throwing, or `registerVehicleTools` itself throwing all previously
 * vanished with zero diagnostic trail. `attempt`/`attempts` are 1-based and
 * inclusive, e.g. "2 of 5".
 */
export type VehicleReadyEvent =
	| { readonly kind: "client-unavailable"; readonly attempt: number; readonly attempts: number; readonly ctx: ExtensionContext }
	| {
			readonly kind: "client-resolution-failed";
			readonly attempt: number;
			readonly attempts: number;
			readonly error: unknown;
			readonly ctx: ExtensionContext;
	  }
	| {
			readonly kind: "registration-failed";
			readonly attempt: number;
			readonly attempts: number;
			readonly error: unknown;
			readonly ctx: ExtensionContext;
	  }
	| { readonly kind: "registered"; readonly attempt: number; readonly ctx: ExtensionContext }
	| { readonly kind: "exhausted"; readonly attempts: number; readonly ctx: ExtensionContext };

export interface VehicleReadyRetryOptions {
	/** Total attempts across the whole resolve+register sequence, including the first. Defaults to 6. */
	readonly attempts?: number;
	/** Delay before the second attempt. Defaults to 250ms. */
	readonly initialDelayMs?: number;
	/** No retry delay is ever allowed to exceed this. Defaults to 5000ms. */
	readonly maxDelayMs?: number;
	/** Multiplier applied to the delay after each failed attempt. Defaults to 2. */
	readonly growFactor?: number;
}

export interface RegisterVehicleToolsWhenReadyOptions extends RegisterVehicleToolsOptions {
	/** Every resolution/registration outcome, success or failure -- see VehicleReadyEvent. Omitting this restores today's silent behavior; a caller wanting the fix should always supply one (e.g. ctx.ui.notify or a structured logger). */
	readonly log?: (event: VehicleReadyEvent) => void;
	readonly retry?: VehicleReadyRetryOptions;
}

const DEFAULT_READY_RETRY_ATTEMPTS = 6;
const DEFAULT_READY_INITIAL_DELAY_MS = 250;
const DEFAULT_READY_MAX_DELAY_MS = 5_000;
const DEFAULT_READY_GROW_FACTOR = 2;

/** Same jittered exponential-backoff shape as handshakeRetryDelayMs, sized for the coarser-grained problem this solves: a daemon that hasn't started at all yet (seconds), not a manifest call mid-flight (milliseconds). */
function readyRetryDelayMs(attemptJustFailed: number, retry: VehicleReadyRetryOptions | undefined): number {
	const initialDelayMs = retry?.initialDelayMs ?? DEFAULT_READY_INITIAL_DELAY_MS;
	const maxDelayMs = retry?.maxDelayMs ?? DEFAULT_READY_MAX_DELAY_MS;
	const growFactor = retry?.growFactor ?? DEFAULT_READY_GROW_FACTOR;
	const raw = Math.min(initialDelayMs * growFactor ** (attemptJustFailed - 1), maxDelayMs);
	return raw * (0.8 + Math.random() * 0.4);
}

/**
 * Wraps `registerVehicleTools` with the one step it never owned: resolving
 * the daemon target and building a client in the first place. That step is
 * inherently consumer-specific (each daemon has its own handle file/target
 * resolution), which is why it was never centralized here before -- but the
 * failure handling around it (silent return on no target, bare catch on any
 * error, no later retry) was reimplemented identically by every consumer
 * and always dropped the failure on the floor. This centralizes that
 * handling once: every step logs through `log` instead of vanishing, and a
 * daemon that is merely slow to start gets bounded retries (see
 * VehicleReadyRetryOptions) instead of a permanent zero-tools outcome for
 * the rest of the session.
 *
 * Registers one `session_start` handler that kicks off the resolve+register
 * sequence in the background (never blocks session_start itself on a
 * multi-attempt backoff) and returns a promise that settles once the
 * sequence either succeeds or exhausts its attempts -- awaiting it is
 * optional, useful mainly for tests and for a caller that wants to know the
 * final outcome (e.g. to show one status line) without polling.
 *
 * Every other `RegisterVehicleToolsOptions` field (including the opt-in
 * `shell` activation mode) passes straight through to the eventual
 * `registerVehicleTools` call unchanged.
 */
export function registerVehicleToolsWhenReady(
	pi: ExtensionAPI,
	resolveClient: () => Promise<VehicleClient | undefined>,
	options: RegisterVehicleToolsWhenReadyOptions = {},
): Promise<RegisteredPiVehicle | undefined> {
	const attempts = Math.max(1, options.retry?.attempts ?? DEFAULT_READY_RETRY_ATTEMPTS);
	let settle!: (value: RegisteredPiVehicle | undefined) => void;
	const done = new Promise<RegisteredPiVehicle | undefined>((resolve) => {
		settle = resolve;
	});

	// `attempt` reuses one ctx captured at session_start across every retry, including across the
	// sleep between attempts -- a session replaced or reloaded during that window leaves `ctx`
	// stale (see extensions.md's "Session replacement lifecycle and footguns"), and a caller's own
	// `log` reading e.g. event.ctx.ui then throws. `attempt` itself runs fire-and-forget (see the
	// `void attempt(1, ctx)` call below), so any exception escaping `log` would otherwise surface
	// as an unhandled rejection that kills the whole host process, not just this one registration
	// attempt. safeLog swallows that failure so a broken/now-stale log callback can never do that,
	// and so every terminal branch still reaches its own settle() call.
	function safeLog(event: VehicleReadyEvent): void {
		try {
			options.log?.(event);
		} catch (error) {
			console.error(`registerVehicleToolsWhenReady: log callback threw for a "${event.kind}" event -- ${error}`);
		}
	}

	async function attempt(attemptNumber: number, ctx: ExtensionContext): Promise<void> {
		let client: VehicleClient | undefined;
		let resolutionFailed = false;
		try {
			client = await resolveClient();
		} catch (error) {
			safeLog({ kind: "client-resolution-failed", attempt: attemptNumber, attempts, error, ctx });
			resolutionFailed = true;
		}

		if (client) {
			try {
				const registered = await registerVehicleTools(pi, client, options);
				safeLog({ kind: "registered", attempt: attemptNumber, ctx });
				settle(registered);
				return;
			} catch (error) {
				safeLog({ kind: "registration-failed", attempt: attemptNumber, attempts, error, ctx });
			}
		} else if (!resolutionFailed) {
			safeLog({ kind: "client-unavailable", attempt: attemptNumber, attempts, ctx });
		}

		if (attemptNumber >= attempts) {
			safeLog({ kind: "exhausted", attempts, ctx });
			settle(undefined);
			return;
		}
		await sleep(readyRetryDelayMs(attemptNumber, options.retry));
		await attempt(attemptNumber + 1, ctx);
	}

	pi.on("session_start", (_event, ctx) => {
		void attempt(1, ctx);
	});

	return done;
}
