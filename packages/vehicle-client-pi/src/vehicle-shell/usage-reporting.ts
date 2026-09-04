/**
 * Reports a Vehicle Shell meta-tool call (tools_list/tools_man/tools_type) into whichever
 * vehicle daemon(s) are relevant, via the real metrics.recordClientEvent operation -- see
 * @danypops/vehicle-server's own vehicle-metrics-operations.ts. These three tools never
 * themselves reach any daemon's invoke() path (they're pure in-process aggregation over cached
 * manifests), so this is the one place client-observed shell usage becomes visible in the same
 * server-side metrics store every real operation invocation already lands in -- deliberately no
 * client-side storage of any kind (see vehicle-server's own metrics README section).
 *
 * Fire-and-forget from every call site in tools.ts: reporting must never add latency to, or
 * affect the outcome of, a real tool call. safeReportShellToolUsage/reportShellToolUsageToAllDiscovered
 * are both synchronous-void, guaranteed never to throw -- a bug in this module, an unreachable
 * vehicle, or a daemon too old to know metrics.recordClientEvent all fail silently, exactly like
 * activity-broker.ts's own "publication is best-effort" contract.
 */
import type { VehicleClient } from "@danypops/vehicle-core";

const CLIENT_EVENT_OPERATION_NAME = "metrics.recordClientEvent";
const CLIENT_EVENT_OPERATION_VERSION = 1;
const CLIENT_EVENT_PERMISSION = "vehicle:metrics:record-client-event";

export type ShellMetaToolName = "tools_list" | "tools_man" | "tools_type";

/**
 * The minimal shape usage reporting needs from a discovered vehicle -- deliberately narrower than
 * DiscoveredVehicle/InProcessDiscoveredVehicle so this module never has to import either (or the
 * cross-process discovery machinery behind them), keeping it trivially unit-testable against a
 * bare fake client.
 */
export interface ReportableVehicle {
	readonly name: string;
	readonly client: Pick<VehicleClient, "invoke">;
}

/**
 * Reports one meta-tool call against every vehicle in `targets` -- never throws, never rejects
 * (Promise.allSettled), safe to call with zero targets (a no-op). A vehicle with no registered
 * metrics.recordClientEvent operation (an older/incompatible daemon) fails that one call
 * silently, exactly like any other target's own failure.
 */
export async function reportShellToolUsage(
	targets: readonly ReportableVehicle[],
	toolName: ShellMetaToolName,
	outcome: "success" | "failure",
	durationMs: number,
	callerSessionId: string | undefined,
	callerProjectRoot: string | undefined,
): Promise<void> {
	await Promise.allSettled(
		targets.map((vehicle) =>
			vehicle.client.invoke(
				CLIENT_EVENT_OPERATION_NAME,
				CLIENT_EVENT_OPERATION_VERSION,
				{ toolName, outcome, durationMs },
				{ permissions: [CLIENT_EVENT_PERMISSION], callerSessionId, callerProjectRoot },
			),
		),
	);
}

/** Distinct-by-name subset of `vehicles` matching `vehicleNames` -- the "one report per distinct vehicle actually touched" rule tools_man/tools_type both need, instead of reporting once per requested NAME (which could double-report the same vehicle for two names it both owns). */
export function reportableVehiclesByName(vehicles: readonly ReportableVehicle[], vehicleNames: ReadonlySet<string>): ReportableVehicle[] {
	return vehicles.filter((vehicle) => vehicleNames.has(vehicle.name));
}

/**
 * Fire-and-forget wrapper for tools_man/tools_type, which already know exactly which vehicles a
 * call touched (no separate discovery needed) -- synchronous void, guaranteed not to throw even
 * if reportShellToolUsage's own internals somehow changed to reject in the future.
 */
export function safeReportShellToolUsage(
	targets: readonly ReportableVehicle[],
	toolName: ShellMetaToolName,
	outcome: "success" | "failure",
	durationMs: number,
	callerSessionId: string | undefined,
	callerProjectRoot: string | undefined,
): void {
	try {
		reportShellToolUsage(targets, toolName, outcome, durationMs, callerSessionId, callerProjectRoot).catch(() => {
			// reportShellToolUsage itself never rejects (Promise.allSettled) -- this guards only
			// against a future refactor accidentally reintroducing a real rejection path.
		});
	} catch {
		// Best-effort: a bug in the reporting path itself must never break a real tool call.
	}
}

/**
 * tools_list's own reporting entry point: it has no single target vehicle (a global browse), so
 * it broadcasts to every vehicle a fresh discovery call returns. `discover` is injected (rather
 * than this module importing discoverAllVehicles directly) so this file never pulls in the
 * cross-process discovery machinery (state.ts's own dynamic-import-only policy for that exact
 * reason) -- the caller (tools.ts) already has it in scope. Runs the discovery + report
 * concurrently with tools_list's own real work from the caller's perspective (never awaited
 * before the tool's real response returns), so it adds no serial latency.
 */
export function reportShellToolUsageToAllDiscovered(
	discover: () => Promise<readonly ReportableVehicle[]>,
	toolName: ShellMetaToolName,
	outcome: "success" | "failure",
	durationMs: number,
	callerSessionId: string | undefined,
	callerProjectRoot: string | undefined,
): void {
	discover().then(
		(vehicles) => safeReportShellToolUsage(vehicles, toolName, outcome, durationMs, callerSessionId, callerProjectRoot),
		() => {
			// discover() itself failing must never affect the real tool call -- nothing to report to.
		},
	);
}
