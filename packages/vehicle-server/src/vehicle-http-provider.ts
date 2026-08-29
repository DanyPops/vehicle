/**
 * Authenticated HTTP surface for a VehicleRegistry -- lets a host expose
 * its Vehicle operations to a RemoteVehicleClient (@danypops/vehicle-client's
 * ./http export), built on this package's own generic Bearer-auth/JSON
 * helpers (./rpc-http, formerly daemon-kit's http.ts -- absorbed here since
 * Vehicle IS the daemon substrate now, not a separate consumer of it).
 *
 * Exported as this package's ./http subpath, kept separate from the root
 * (VehicleRegistry) export -- a consumer that only builds/tests a registry
 * has no reason to pull in HTTP request/response plumbing.
 * Daemon-side raw TypeScript, not part of any Pi-loaded compiled surface.
 * Core routes:
 *   GET  /vehicle/manifest        -> the registry's current VehicleManifest
 *   POST /vehicle/negotiate       -> agree on a wire version and capabilities
 *   POST /vehicle/invoke          -> invoke one operation; JSON by default,
 *                                    Server-Sent Events when the request
 *                                    sends `Accept: text/event-stream`
 *                                    (needed for progress -- a plain JSON
 *                                    response can only carry a final result)
 *   POST /vehicle/cancel          -> best-effort cancellation of a still-
 *                                    in-flight operationId
 * Vehicle Jobs routes (only served when `jobStore` is configured; 404
 * otherwise -- a host that never opts into background execution pays
 * nothing extra and a client can't accidentally submit into a void):
 *   POST /vehicle/jobs/submit     -> submit a background-capable operation,
 *                                    returns { jobId } immediately
 *   POST /vehicle/jobs/poll       -> current VehicleJobSnapshot by jobId,
 *                                    never blocks
 *   POST /vehicle/jobs/tail       -> progress entries since a cursor, plus
 *                                    the next cursor, never blocks
 *   POST /vehicle/jobs/steer      -> pushes new input to a running job's
 *                                    handler
 *   POST /vehicle/jobs/cancel     -> best-effort cancellation of a still-
 *                                    running job by jobId (distinct from
 *                                    /vehicle/cancel's operationId, which
 *                                    only ever addresses a live invoke())
 *
 * Local/HTTP parity: every VehicleInvocationOptions field LocalVehicleClient
 * accepts is threaded through the wire body; the same VehicleError shape
 * comes back as a JSON `error` field with an HTTP status derived from its
 * category, so RemoteVehicleClient reconstructs the identical VehicleError
 * a local caller would have seen. The same parity holds for jobs: every
 * VehicleJobSubmitOptions field is threaded through, and job errors
 * (job-not-found, job-steer-queue-full, ...) round-trip the same way.
 */
import { randomUUID } from "node:crypto";
import type {
	VehicleFailure,
	VehicleFailureCategory,
	VehicleInvocationOptions,
	VehicleJobSubmitOptions,
	VehiclePrincipal,
	VehicleProtocolOffer,
} from "@danypops/vehicle-core";
import { isVehicleError, MAX_VEHICLE_PROTOCOL_OFFER_BYTES, VehicleError } from "@danypops/vehicle-core";
import { errorResponse, jsonResponse, requireBearerToken } from "./http.js";
import type { Logger } from "./logging.js";
import type { VehicleJobStore } from "./vehicle-job-store.js";
import type { VehicleRegistry } from "./vehicle-registry.js";

const UNAUTHORIZED_RESPONSE: Response = errorResponse("unauthorized", 401);
const JOBS_NOT_SUPPORTED_RESPONSE: Response = errorResponse("Vehicle Jobs are not supported by this daemon", 404);

const NOOP_LOGGER: Logger = { debug() {}, info() {}, warn() {}, error() {} };

export interface VehicleInvocationAuthority {
	readonly permissions: readonly string[];
	readonly principal?: VehiclePrincipal;
}

export interface VehicleHttpTransportContext {
	readonly transport: "http" | "unix";
	readonly peer?: Readonly<{ pid?: number; uid?: number; gid?: number }>;
}

export type VehicleInvocationAuthorityPolicy =
	| { readonly mode: "caller-asserted" }
	| {
			readonly mode: "attested";
			resolve(request: Request, context: VehicleHttpTransportContext): VehicleInvocationAuthority | Promise<VehicleInvocationAuthority>;
	  };

export interface VehicleHttpProviderOptions {
	registry: VehicleRegistry;
	token: string;
	/** Defaults to caller-asserted for backward compatibility. New cross-trust-boundary deployments use attested authority. */
	invocationAuthority?: VehicleInvocationAuthorityPolicy;
	/**
	 * Defaults to a no-op logger. Without one, a failed invocation is sanitized
	 * into a wire-safe VehicleFailure (code/category/message only, per this
	 * house's own "never leak internals over the wire" discipline) and returned
	 * to the caller -- but the real cause (a handler's own thrown error,
	 * including its stack) is otherwise discarded the moment this function
	 * returns, unrecoverable from any log. Pass a real logger to keep it.
	 */
	logger?: Logger;
	/**
	 * Opts this daemon into serving the /vehicle/jobs/* routes at all -- omitted (the default)
	 * means every job route 404s, matching a host that never wired one up not paying any extra
	 * surface. A host with background-capable operations passes its own VehicleJobStore, built on
	 * this same `registry`.
	 */
	jobStore?: VehicleJobStore;
}

interface InvokeRequestBody {
	name?: unknown;
	version?: unknown;
	input?: unknown;
	operationId?: unknown;
	correlationId?: unknown;
	deadlineMs?: unknown;
	permissions?: unknown;
	principal?: unknown;
	idempotencyKey?: unknown;
	expectedRevision?: unknown;
	approvalCapability?: unknown;
	callerSessionId?: unknown;
	callerProjectRoot?: unknown;
}

function statusForCategory(category: VehicleFailureCategory): number {
	switch (category) {
		case "validation":
			return 400;
		case "not_found":
			return 404;
		case "conflict":
			return 409;
		case "authorization":
			return 403;
		case "capacity":
			return 413;
		case "timeout":
			return 504;
		case "cancelled":
			return 400;
		case "unavailable":
			return 503;
		default:
			return 500;
	}
}

function toFailurePayload(error: unknown): VehicleFailure {
	if (isVehicleError(error)) return error.toFailure();
	return { code: "internal", category: "internal", message: "internal error", retryable: false };
}

/**
 * Logs the real, unsanitized cause of a failed invocation before it's
 * reduced to a wire-safe VehicleFailure -- the sanitized payload alone
 * (e.g. "tasks.complete@1 handler failed") names which operation failed but
 * never why; the operator-facing side of that same failure needs the
 * underlying error/stack this function preserves.
 */
function logInvokeFailure(logger: Logger, name: string, version: number, operationId: string, error: unknown): void {
	const vehicleError = isVehicleError(error) ? error : undefined;
	const cause = vehicleError?.cause;
	logger.error(`vehicle invoke failed: ${name}@${version}`, {
		operationId,
		code: vehicleError?.code,
		category: vehicleError?.category,
		message: error instanceof Error ? error.message : String(error),
		cause: cause instanceof Error ? (cause.stack ?? cause.message) : cause !== undefined ? String(cause) : undefined,
	});
}

function transportContext(value: unknown): VehicleHttpTransportContext {
	if (typeof value !== "object" || value === null) return { transport: "http" };
	const candidate = value as { transport?: unknown; peer?: unknown };
	if (candidate.transport !== "http" && candidate.transport !== "unix") return { transport: "http" };
	if (typeof candidate.peer !== "object" || candidate.peer === null) return { transport: candidate.transport };
	const rawPeer = candidate.peer as { pid?: unknown; uid?: unknown; gid?: unknown };
	const peer = {
		...(Number.isSafeInteger(rawPeer.pid) ? { pid: rawPeer.pid as number } : {}),
		...(Number.isSafeInteger(rawPeer.uid) ? { uid: rawPeer.uid as number } : {}),
		...(Number.isSafeInteger(rawPeer.gid) ? { gid: rawPeer.gid as number } : {}),
	};
	return { transport: candidate.transport, peer };
}

export function createVehicleHttpApp(options: VehicleHttpProviderOptions): { fetch(request: Request, context?: unknown): Promise<Response> } {
	const inFlight = new Map<string, AbortController>();
	const logger = options.logger ?? NOOP_LOGGER;

	return {
		async fetch(request: Request, suppliedContext?: unknown): Promise<Response> {
			if (!requireBearerToken(request, options.token)) return UNAUTHORIZED_RESPONSE;
			const context = transportContext(suppliedContext);
			const url = new URL(request.url);

			if (request.method === "GET" && url.pathname === "/vehicle/manifest") {
				return jsonResponse(options.registry.manifest());
			}

			if (request.method === "POST" && url.pathname === "/vehicle/negotiate") {
				let offer: VehicleProtocolOffer;
				try {
					const encoded = await request.text();
					if (new TextEncoder().encode(encoded).byteLength > MAX_VEHICLE_PROTOCOL_OFFER_BYTES) {
						return errorResponse(`protocol offer exceeds ${MAX_VEHICLE_PROTOCOL_OFFER_BYTES} bytes`, 413);
					}
					offer = JSON.parse(encoded) as VehicleProtocolOffer;
				} catch {
					return errorResponse("invalid JSON body", 400);
				}
				try {
					return jsonResponse({ agreement: options.registry.negotiate(offer) });
				} catch (error) {
					const failure = toFailurePayload(error);
					return jsonResponse({ error: failure }, { status: statusForCategory(failure.category) });
				}
			}

			if (request.method === "POST" && url.pathname === "/vehicle/cancel") {
				let body: { operationId?: unknown };
				try {
					body = (await request.json()) as { operationId?: unknown };
				} catch {
					return errorResponse("invalid JSON body", 400);
				}
				if (typeof body.operationId === "string") inFlight.get(body.operationId)?.abort();
				return new Response(null, { status: 204 });
			}

			if (request.method === "POST" && url.pathname === "/vehicle/invoke") {
				return handleInvoke(request, options.registry, inFlight, logger, options.invocationAuthority, context);
			}

			if (url.pathname.startsWith("/vehicle/jobs/")) {
				if (!options.jobStore) return JOBS_NOT_SUPPORTED_RESPONSE;
				if (request.method !== "POST") return errorResponse("not found", 404);
				switch (url.pathname) {
					case "/vehicle/jobs/submit":
						return handleJobSubmit(request, options.jobStore, options.invocationAuthority, context);
					case "/vehicle/jobs/poll":
						return handleJobPoll(request, options.jobStore);
					case "/vehicle/jobs/tail":
						return handleJobTail(request, options.jobStore);
					case "/vehicle/jobs/steer":
						return handleJobSteer(request, options.jobStore);
					case "/vehicle/jobs/cancel":
						return handleJobCancel(request, options.jobStore);
					default:
						return errorResponse("not found", 404);
				}
			}

			return errorResponse("not found", 404);
		},
	};
}

const MAX_ATTESTED_PERMISSIONS = 128;
const MAX_ATTESTED_PERMISSION_LENGTH = 200;

function isInvocationAuthority(value: unknown): value is VehicleInvocationAuthority {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value as { permissions?: unknown; principal?: unknown };
	if (
		!Array.isArray(candidate.permissions) ||
		candidate.permissions.length > MAX_ATTESTED_PERMISSIONS ||
		candidate.permissions.some(
			(permission) => typeof permission !== "string" || !permission.trim() || permission.length > MAX_ATTESTED_PERMISSION_LENGTH,
		)
	) return false;
	if (candidate.principal === undefined) return true;
	if (typeof candidate.principal !== "object" || candidate.principal === null) return false;
	const principal = candidate.principal as { id?: unknown; claims?: unknown };
	return typeof principal.id === "string" && principal.id.trim().length > 0 && (principal.claims === undefined || (typeof principal.claims === "object" && principal.claims !== null));
}

async function resolveInvocationAuthority(
	policy: VehicleInvocationAuthorityPolicy | undefined,
	request: Request,
	context: VehicleHttpTransportContext,
): Promise<VehicleInvocationAuthority | undefined> {
	if (!policy || policy.mode === "caller-asserted") return undefined;
	const authority = await policy.resolve(request, context);
	if (!isInvocationAuthority(authority)) {
		throw new VehicleError("invalid-invocation-authority", "Authenticated transport resolved an invalid invocation authority", {
			category: "internal",
		});
	}
	return authority;
}

async function handleInvoke(
	request: Request,
	registry: VehicleRegistry,
	inFlight: Map<string, AbortController>,
	logger: Logger,
	authorityPolicy: VehicleInvocationAuthorityPolicy | undefined,
	transportContext: VehicleHttpTransportContext,
): Promise<Response> {
	let body: InvokeRequestBody;
	try {
		body = (await request.json()) as InvokeRequestBody;
	} catch {
		return errorResponse("invalid JSON body", 400);
	}
	if (typeof body.name !== "string" || typeof body.version !== "number") {
		return errorResponse("name and version are required", 400);
	}

	let authority: VehicleInvocationAuthority | undefined;
	try {
		authority = await resolveInvocationAuthority(authorityPolicy, request, transportContext);
	} catch (error) {
		const failure = toFailurePayload(error);
		return jsonResponse({ error: failure }, { status: statusForCategory(failure.category) });
	}

	const operationId = typeof body.operationId === "string" && body.operationId.trim() ? body.operationId : randomUUID();
	const controller = new AbortController();
	inFlight.set(operationId, controller);

	const invocationOptions: VehicleInvocationOptions = {
		operationId,
		correlationId: typeof body.correlationId === "string" ? body.correlationId : undefined,
		signal: controller.signal,
		deadline: typeof body.deadlineMs === "number" ? Date.now() + body.deadlineMs : undefined,
		permissions: authority ? [...authority.permissions] : Array.isArray(body.permissions) ? (body.permissions as string[]) : undefined,
		principal: authority?.principal ?? ((body.principal as VehiclePrincipal | undefined) ?? undefined),
		idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined,
		expectedRevision: body.expectedRevision as string | number | undefined,
		approvalCapability: typeof body.approvalCapability === "string" ? body.approvalCapability : undefined,
		// See VehicleInvocationOptions's own doc comment (vehicle-core) -- a generic
		// ownership/attribution hook a handler can read (e.g. scoping a background
		// subscription, or a session-scoped focus pointer, to the session/project that
		// created it). Was silently dropped here until now -- vehicle-client-pi already
		// computes and sends both correctly, but RemoteVehicleClient never put them on
		// the wire and this provider never read them, so every remote (non-LocalVehicleClient)
		// caller always saw both as undefined despite this file's own "every field is
		// threaded through" doc comment above.
		callerSessionId: typeof body.callerSessionId === "string" ? body.callerSessionId : undefined,
		callerProjectRoot: typeof body.callerProjectRoot === "string" ? body.callerProjectRoot : undefined,
	};

	const wantsStream = (request.headers.get("accept") ?? "").includes("text/event-stream");

	if (wantsStream) {
		return streamInvoke(registry, body.name, body.version, body.input, invocationOptions, controller, logger, () =>
			inFlight.delete(operationId),
		);
	}

	try {
		const output = await registry.invoke(body.name, body.version, body.input, invocationOptions);
		return jsonResponse({ output, operationId });
	} catch (error) {
		logInvokeFailure(logger, body.name, body.version, operationId, error);
		const failure = toFailurePayload(error);
		return jsonResponse({ error: failure, operationId }, { status: statusForCategory(failure.category) });
	} finally {
		inFlight.delete(operationId);
	}
}

function streamInvoke(
	registry: VehicleRegistry,
	name: string,
	version: number,
	input: unknown,
	invocationOptions: VehicleInvocationOptions,
	abortController: AbortController,
	logger: Logger,
	cleanup: () => void,
): Response {
	const encoder = new TextEncoder();
	// A client can disconnect (deadline, its own abort, a dropped connection) at any point
	// while registry.invoke() is still running -- the runtime then closes this stream's
	// controller on its own, out from under us. Without tracking that, the eventual
	// registry.invoke() settlement (progress, result, or error) calls enqueue()/close() on an
	// already-closed controller and throws, as an unhandled rejection with no .catch --
	// which crashed the whole process (confirmed live against pipes.service).
	let closed = false;
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const safeEnqueue = (chunk: Uint8Array): void => {
				if (closed) return;
				try {
					controller.enqueue(chunk);
				} catch {
					// Closed by the runtime between our check and this call (client disconnected concurrently) -- same as cancel().
					closed = true;
				}
			};
			const safeClose = (): void => {
				if (closed) return;
				closed = true;
				try {
					controller.close();
				} catch {
					// Already closed by the runtime -- nothing left to do.
				}
			};
			const withProgress: VehicleInvocationOptions = {
				...invocationOptions,
				onProgress: (progress) => safeEnqueue(encoder.encode(`event: progress\ndata: ${JSON.stringify(progress)}\n\n`)),
			};
			registry.invoke(name, version, input, withProgress).then(
				(output) => {
					safeEnqueue(encoder.encode(`event: result\ndata: ${JSON.stringify({ output })}\n\n`));
					safeClose();
					cleanup();
				},
				(error: unknown) => {
					logInvokeFailure(logger, name, version, invocationOptions.operationId ?? "unknown", error);
					safeEnqueue(encoder.encode(`event: error\ndata: ${JSON.stringify(toFailurePayload(error))}\n\n`));
					safeClose();
					cleanup();
				},
			);
		},
		// Fires when the client disconnects (deadline elapsed, its own AbortController, a dropped
		// connection) -- abort the still-running operation instead of letting it run to completion
		// for a caller no longer listening, and stop any further writes from this side too.
		cancel() {
			closed = true;
			abortController.abort();
			cleanup();
		},
	});
	return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache" } });
}

interface JobSubmitRequestBody {
	name?: unknown;
	version?: unknown;
	input?: unknown;
	permissions?: unknown;
	principal?: unknown;
	idempotencyKey?: unknown;
	expectedRevision?: unknown;
	approvalCapability?: unknown;
	correlationId?: unknown;
	callerSessionId?: unknown;
	callerProjectRoot?: unknown;
	notifyMode?: unknown;
	wakeBudget?: unknown;
	maxLifetimeMs?: unknown;
}

function jobFailureResponse(error: unknown): Response {
	const failure = toFailurePayload(error);
	return jsonResponse({ error: failure }, { status: statusForCategory(failure.category) });
}

async function parseJsonBody<T>(request: Request): Promise<{ ok: true; body: T } | { ok: false; response: Response }> {
	try {
		return { ok: true, body: (await request.json()) as T };
	} catch {
		return { ok: false, response: errorResponse("invalid JSON body", 400) };
	}
}

async function handleJobSubmit(
	request: Request,
	jobStore: VehicleJobStore,
	authorityPolicy: VehicleInvocationAuthorityPolicy | undefined,
	transportContext: VehicleHttpTransportContext,
): Promise<Response> {
	const parsed = await parseJsonBody<JobSubmitRequestBody>(request);
	if (!parsed.ok) return parsed.response;
	const body = parsed.body;
	if (typeof body.name !== "string" || typeof body.version !== "number") {
		return errorResponse("name and version are required", 400);
	}
	let authority: VehicleInvocationAuthority | undefined;
	try {
		authority = await resolveInvocationAuthority(authorityPolicy, request, transportContext);
	} catch (error) {
		return jobFailureResponse(error);
	}
	const submitOptions: VehicleJobSubmitOptions = {
		permissions: authority ? [...authority.permissions] : Array.isArray(body.permissions) ? (body.permissions as string[]) : undefined,
		principal: authority?.principal ?? ((body.principal as VehiclePrincipal | undefined) ?? undefined),
		idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined,
		expectedRevision: body.expectedRevision as string | number | undefined,
		approvalCapability: typeof body.approvalCapability === "string" ? body.approvalCapability : undefined,
		correlationId: typeof body.correlationId === "string" ? body.correlationId : undefined,
		callerSessionId: typeof body.callerSessionId === "string" ? body.callerSessionId : undefined,
		callerProjectRoot: typeof body.callerProjectRoot === "string" ? body.callerProjectRoot : undefined,
		notifyMode: body.notifyMode as VehicleJobSubmitOptions["notifyMode"],
		wakeBudget: body.wakeBudget as VehicleJobSubmitOptions["wakeBudget"],
		maxLifetimeMs: typeof body.maxLifetimeMs === "number" ? body.maxLifetimeMs : undefined,
	};
	try {
		const result = jobStore.submit(body.name, body.version, body.input, submitOptions);
		return jsonResponse(result);
	} catch (error) {
		return jobFailureResponse(error);
	}
}

async function handleJobPoll(request: Request, jobStore: VehicleJobStore): Promise<Response> {
	const parsed = await parseJsonBody<{ jobId?: unknown }>(request);
	if (!parsed.ok) return parsed.response;
	if (typeof parsed.body.jobId !== "string") return errorResponse("jobId is required", 400);
	try {
		return jsonResponse(jobStore.poll(parsed.body.jobId));
	} catch (error) {
		return jobFailureResponse(error);
	}
}

async function handleJobTail(request: Request, jobStore: VehicleJobStore): Promise<Response> {
	const parsed = await parseJsonBody<{ jobId?: unknown; cursor?: unknown }>(request);
	if (!parsed.ok) return parsed.response;
	if (typeof parsed.body.jobId !== "string") return errorResponse("jobId is required", 400);
	const cursor = typeof parsed.body.cursor === "number" ? parsed.body.cursor : 0;
	try {
		return jsonResponse(jobStore.tail(parsed.body.jobId, cursor));
	} catch (error) {
		return jobFailureResponse(error);
	}
}

async function handleJobSteer(request: Request, jobStore: VehicleJobStore): Promise<Response> {
	const parsed = await parseJsonBody<{ jobId?: unknown; input?: unknown }>(request);
	if (!parsed.ok) return parsed.response;
	if (typeof parsed.body.jobId !== "string") return errorResponse("jobId is required", 400);
	try {
		jobStore.steer(parsed.body.jobId, parsed.body.input);
		return new Response(null, { status: 204 });
	} catch (error) {
		return jobFailureResponse(error);
	}
}

async function handleJobCancel(request: Request, jobStore: VehicleJobStore): Promise<Response> {
	const parsed = await parseJsonBody<{ jobId?: unknown }>(request);
	if (!parsed.ok) return parsed.response;
	if (typeof parsed.body.jobId !== "string") return errorResponse("jobId is required", 400);
	try {
		jobStore.cancel(parsed.body.jobId);
		return new Response(null, { status: 204 });
	} catch (error) {
		return jobFailureResponse(error);
	}
}
