/**
 * Production instrumentation for vehicle-client-pi's own internal failure-classification path
 * (see sanitizedFailure() in vehicle-pi.ts). This is not a debug scaffold: it's a permanent,
 * two-channel diagnostic surface for a class of failure that must never happen but, if it ever
 * does again, must be immediately diagnosable in a live agent session without a source checkout,
 * a debugger, or hand-patching an installed dist file:
 *
 * 1. `node:diagnostics_channel` (channel name below) -- Node's own built-in, near-zero-overhead
 *    publish/subscribe primitive for library instrumentation (stable since Node 15, the same
 *    mechanism undici/http/APM vendors use so they don't have to monkey-patch each other). A
 *    real observability pipeline (OpenTelemetry, dd-trace, an in-house collector) can subscribe
 *    to this channel and get a structured event with zero cost when nobody is listening -- no
 *    file I/O, no env var, no code change here required to add a new subscriber.
 * 2. An opt-in JSONL file log, gated by VEHICLE_CLIENT_DIAG=1, matching the exact convention
 *    already shipped for pi-papyrus's PAPYRUS_RENDER_DIAG: best-effort (never throws, never
 *    blocks or fails a real invocation), content-safe (only short categorical fields and
 *    lengths, never arbitrary error/body text beyond what sanitizedFailure's own ordinary
 *    fallback message already exposes to the caller), and human-readable without any tooling --
 *    the fast path for a person debugging one live session interactively.
 */
import diagnosticsChannel from "node:diagnostics_channel";
import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/** Documented per node:diagnostics_channel's own guidance: a module producing diagnostics data should publish its channel name and message shape for subscribers to rely on. */
export const CLASSIFICATION_FAILURE_CHANNEL_NAME = "vehicle-client-pi:classification-failure";

export interface ClassificationFailureEvent {
	readonly ts: string;
	/** The original error's own constructor name (e.g. "TypeError"), never its message/stack -- see the file-level doc comment on content-safety. */
	readonly originalErrorKind: string;
	/** What actually went wrong while classifying it -- sanitizedFailure() itself must never throw this uncaught again. */
	readonly internalFailureKind: string;
	readonly internalFailureMessage: string;
}

const classificationFailureChannel = diagnosticsChannel.channel(CLASSIFICATION_FAILURE_CHANNEL_NAME);

function isDiagEnabled(): boolean {
	return process.env.VEHICLE_CLIENT_DIAG === "1";
}

function diagPath(): string {
	return process.env.VEHICLE_CLIENT_DIAG_PATH ?? join(homedir(), ".cache", "vehicle", "client-diag.log");
}

/** Best-effort JSONL append -- a broken/unwritable diagnostic path must never break a real invocation. */
function appendDiagLine<T extends object>(entry: T): void {
	if (!isDiagEnabled()) return;
	try {
		const path = diagPath();
		mkdirSync(dirname(path), { recursive: true });
		appendFileSync(path, `${JSON.stringify(entry)}\n`);
	} catch {
		/* best-effort -- a broken diagnostic log must never break a real invocation */
	}
}

/** publish-unconditionally-then-file-log-if-enabled, the one shared shape every channel below uses. */
function publishAndLog<T extends object>(channel: diagnosticsChannel.Channel, entry: T): void {
	if (channel.hasSubscribers) channel.publish(entry);
	appendDiagLine({ channel: channel.name, ...entry });
}

/**
 * The very value this module exists to report on can itself be arbitrarily poisoned (a Proxy
 * with a throwing getPrototypeOf trap reproduces the original live incident's failure mode one
 * level removed) -- a plain `value instanceof Error` here would repeat the exact bug this module
 * diagnoses. Each extractor is independently wrapped so one poisoned field can never suppress
 * the others.
 */
function safeErrorKind(value: unknown): string {
	try {
		return value instanceof Error ? value.constructor.name : typeof value;
	} catch {
		return "unknown";
	}
}

function safeErrorMessage(value: unknown): string {
	try {
		return value instanceof Error ? value.message : String(value);
	} catch {
		return "unknown";
	}
}

/**
 * Reports that sanitizedFailure()'s own classification chain failed internally while handling
 * `originalError` -- e.g. an instanceof check whose right-hand side unexpectedly resolved to a
 * non-object at runtime (a broken/duplicated dependency resolution), or any other exception a
 * classifier must never let escape. Publishes to the diagnostics_channel unconditionally
 * (subscribing is the opt-in there) and appends to the file log only when VEHICLE_CLIENT_DIAG=1.
 *
 * Never throws on its own account. A subscriber's own exception is deliberately not this
 * function's concern to swallow: `channel.publish()` already isolates that to
 * `process.on('uncaughtException')` per node:diagnostics_channel's own documented contract --
 * "we don't want a publisher to crash only because a subscriber is doing something wrong" -- so
 * duplicating that protection here would be redundant at best and would mask a genuinely broken
 * subscriber at worst. A subscriber that throws is a bug in that subscriber, not in this module.
 */
export function reportClassificationFailure(originalError: unknown, internalFailure: unknown): void {
	const event: ClassificationFailureEvent = {
		ts: new Date().toISOString(),
		originalErrorKind: safeErrorKind(originalError),
		internalFailureKind: safeErrorKind(internalFailure),
		internalFailureMessage: safeErrorMessage(internalFailure),
	};
	if (classificationFailureChannel.hasSubscribers) classificationFailureChannel.publish(event);
	appendDiagLine(event);
}

/** Exposed for a test/subscriber that wants the live channel object directly rather than re-deriving it from the name. */
export function __classificationFailureChannelForTests(): diagnosticsChannel.Channel {
	return classificationFailureChannel;
}

/**
 * The Vehicle Shell lifecycle's own diagnostic surface, same convention/env vars as
 * reportClassificationFailure above: answers "did tools_list/tools_man/registerVehicleShell
 * actually execute in this process, from this module" from outside the process, without a
 * debugger or a hand-patched dist file -- module load is the coarsest signal (fires on import,
 * independent of whether any tool is ever called), the other three confirm the specific
 * lifecycle step under question.
 */
export const MODULE_LOAD_CHANNEL_NAME = "vehicle-client-pi:module-load";
export const SHELL_REGISTERED_CHANNEL_NAME = "vehicle-client-pi:shell-registered";
export const TOOLS_LIST_EXECUTE_CHANNEL_NAME = "vehicle-client-pi:tools-list-execute";
export const TOOLS_MAN_EXECUTE_CHANNEL_NAME = "vehicle-client-pi:tools-man-execute";

const moduleLoadChannel = diagnosticsChannel.channel(MODULE_LOAD_CHANNEL_NAME);
const shellRegisteredChannel = diagnosticsChannel.channel(SHELL_REGISTERED_CHANNEL_NAME);
const toolsListExecuteChannel = diagnosticsChannel.channel(TOOLS_LIST_EXECUTE_CHANNEL_NAME);
const toolsManExecuteChannel = diagnosticsChannel.channel(TOOLS_MAN_EXECUTE_CHANNEL_NAME);

/** Fires once per module evaluation (once per distinct copy actually imported by the runtime), not per call. */
export function reportModuleLoad(moduleUrl: string): void {
	publishAndLog(moduleLoadChannel, { ts: new Date().toISOString(), moduleUrl });
}

export function reportShellRegistered(vehicleName: string, listToolName: string, manToolName: string, ownsMetaTools: boolean): void {
	publishAndLog(shellRegisteredChannel, { ts: new Date().toISOString(), vehicleName, listToolName, manToolName, ownsMetaTools });
}

export function reportToolsListExecute(vehicleName: string, query: string): void {
	publishAndLog(toolsListExecuteChannel, { ts: new Date().toISOString(), vehicleName, query });
}

export function reportToolsManExecute(vehicleName: string, names: readonly string[]): void {
	publishAndLog(toolsManExecuteChannel, { ts: new Date().toISOString(), vehicleName, names });
}
