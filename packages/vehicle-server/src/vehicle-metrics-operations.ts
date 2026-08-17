/**
 * Exposes a Vehicle's own metrics store (vehicle-metrics-store.ts) as two real Vehicle
 * operations -- discoverable, callable, and documented through the exact same tools_list/
 * tools_man path as every other operation (dogfooding this repo's own discovery mechanism):
 *
 * - metrics.query (read): time-range + optional-filter query over every invocation this Vehicle
 *   has recorded, server-side ones (via vehicle-metrics-middleware.ts) and client-reported shell
 *   meta-tool calls alike.
 * - metrics.recordClientEvent (local-write): the one write path a client (vehicle-client-pi's
 *   Vehicle Shell) uses to report a tools_list/tools_man/tools_type call it observed but that
 *   never itself reached this daemon's own invoke() path (those tools are pure in-process
 *   aggregation over cached manifests -- they never call invoke() at all). Restricted to a
 *   narrow, known enum of shell tool names, not an arbitrary open-ended event, since this is a
 *   real write path any authorized caller can reach.
 */
import { bindVehicleOperation, defineLooseObjectSchema, defineVehicleOperation, passthroughVehicleSchema, VehicleError } from "@danypops/vehicle-core";
// Literal .ts extension -- see vehicle-metrics-middleware.ts's own comment on this same import.
import type { VehicleRegistry } from "./vehicle-registry.ts";
import type { VehicleMetricsGroupDimension, VehicleMetricsOutcome, VehicleMetricsQuery, VehicleMetricsStore } from "./vehicle-metrics-store.js";

const OWNER = "metrics";
const LIMITS = { defaultTimeoutMs: 5_000, maxTimeoutMs: 30_000, maxRequestBytes: 65_536, maxResponseBytes: 1_048_576 };

const GROUP_DIMENSIONS: readonly VehicleMetricsGroupDimension[] = ["toolName", "vehicleName", "source", "callerSessionId", "outcome", "day", "hour"];
const OUTCOMES: readonly VehicleMetricsOutcome[] = ["success", "failure"];

/** The only tool names a client is ever allowed to self-report -- vehicle-client-pi's own Vehicle Shell meta-tools, which never themselves reach this daemon's invoke() path. Every real operation invocation is already captured automatically by vehicle-metrics-middleware.ts; a client has no business reporting one of those itself. */
export const CLIENT_REPORTABLE_TOOL_NAMES = ["tools_list", "tools_man", "tools_type"] as const;
export type ClientReportableToolName = (typeof CLIENT_REPORTABLE_TOOL_NAMES)[number];

function requireString(input: Record<string, unknown>, key: string): string {
	const value = input[key];
	if (typeof value !== "string" || value.length === 0) {
		throw new VehicleError("invalid-input", `${key} is required`, { category: "validation" });
	}
	return value;
}

function optionalString(input: Record<string, unknown>, key: string): string | undefined {
	const value = input[key];
	return typeof value === "string" ? value : undefined;
}

function optionalNumber(input: Record<string, unknown>, key: string): number | undefined {
	const value = input[key];
	return typeof value === "number" ? value : undefined;
}

function toQuery(input: Record<string, unknown>): VehicleMetricsQuery {
	const groupByRaw = input.groupBy;
	const groupBy = Array.isArray(groupByRaw)
		? groupByRaw.filter((value): value is VehicleMetricsGroupDimension => typeof value === "string" && (GROUP_DIMENSIONS as readonly string[]).includes(value))
		: undefined;
	const source = optionalString(input, "source");
	if (source !== undefined && source !== "server" && source !== "client") {
		throw new VehicleError("invalid-input", `source must be "server" or "client", got "${source}"`, { category: "validation" });
	}
	return {
		since: optionalNumber(input, "since"),
		until: optionalNumber(input, "until"),
		source,
		toolName: optionalString(input, "toolName"),
		vehicleName: optionalString(input, "vehicleName"),
		callerSessionId: optionalString(input, "callerSessionId"),
		groupBy,
	};
}

/**
 * Registers `<vehicleName>:metrics.query` and `<vehicleName>:metrics.recordClientEvent` against
 * `registry`, backed by `store`. Call once per Vehicle daemon, alongside
 * `registry.useExecutionMiddleware(createVehicleMetricsMiddleware(store, vehicleName))` --
 * see vehicle-metrics-middleware.ts.
 */
export function registerVehicleMetricsOperations(registry: VehicleRegistry, store: VehicleMetricsStore, vehicleName: string): void {
	const queryOperation = defineVehicleOperation({
		name: "metrics.query",
		version: 1,
		description:
			`Queries ${vehicleName}'s own recorded tool/operation invocation history -- every real operation call (server-recorded automatically) and every client-reported Vehicle Shell meta-tool call (tools_list/tools_man/tools_type), forever-retained and filterable by time range. ` +
			`since/until are epoch milliseconds (since inclusive, until exclusive); omit either for an open-ended range. groupBy accepts any of: ${GROUP_DIMENSIONS.join(", ")}. Omit groupBy for a single ungrouped total.`,
		input: defineLooseObjectSchema(
			{
				since: { type: "integer" },
				until: { type: "integer" },
				source: { type: "string", enum: ["server", "client"] },
				toolName: { type: "string" },
				vehicleName: { type: "string" },
				callerSessionId: { type: "string" },
				groupBy: { type: "array" },
			},
			[],
		),
		output: passthroughVehicleSchema,
		permissions: [],
		effect: "read",
		idempotency: { mode: "safe" },
		limits: LIMITS,
	});
	registry.register(
		OWNER,
		bindVehicleOperation(queryOperation, () => async (context) => store.query(toQuery(context.input))),
	);

	const recordClientEventOperation = defineVehicleOperation({
		name: "metrics.recordClientEvent",
		version: 1,
		description:
			`Records one client-observed Vehicle Shell meta-tool call (${CLIENT_REPORTABLE_TOOL_NAMES.join("/")}) against ${vehicleName}'s own metrics store -- these tools never themselves reach this daemon's invoke() path, so a client reports them explicitly. Every real operation invocation is already captured automatically; this is not a general-purpose event sink.`,
		input: defineLooseObjectSchema(
			{
				toolName: { type: "string", enum: [...CLIENT_REPORTABLE_TOOL_NAMES] },
				outcome: { type: "string", enum: [...OUTCOMES] },
				durationMs: { type: "integer" },
				callerSessionId: { type: "string" },
				callerProjectRoot: { type: "string" },
			},
			["toolName", "outcome"],
		),
		output: passthroughVehicleSchema,
		permissions: [],
		effect: "local-write",
		idempotency: { mode: "unsafe" },
		limits: LIMITS,
	});
	registry.register(
		OWNER,
		bindVehicleOperation(recordClientEventOperation, () => async (context) => {
			const input = context.input;
			const toolName = requireString(input, "toolName");
			const outcome = requireString(input, "outcome");
			if (outcome !== "success" && outcome !== "failure") {
				throw new VehicleError("invalid-input", `outcome must be "success" or "failure", got "${outcome}"`, { category: "validation" });
			}
			store.record({
				source: "client",
				vehicleName,
				toolName,
				outcome,
				durationMs: optionalNumber(input, "durationMs"),
				callerSessionId: optionalString(input, "callerSessionId") ?? context.callerSessionId,
				callerProjectRoot: optionalString(input, "callerProjectRoot") ?? context.callerProjectRoot,
				principalId: context.principal?.id,
			});
			return { recorded: true };
		}),
	);
}
