/**
 * Namespaced-operation-name resolution/classification for the Vehicle Shell (bare vs. namespaced
 * names, "type -a" style ambiguity, tools_type's own status classification). Split out of
 * vehicle-shell.ts's own bundled concerns.
 */

import type { VehicleManifestOperation } from "@danypops/vehicle-core";
import type { VehicleShellManagedTool } from "./state.js";
import type { WeightedLruTracker } from "./weighted-lru.js";

/** Splits a namespaced "<vehicle>:<operation>" name; undefined when name carries no vehicle prefix at all. */
export function splitNamespacedName(name: string): { vehicleName: string; operationName: string } | undefined {
	const separator = name.indexOf(":");
	if (separator <= 0 || separator === name.length - 1) return undefined;
	return { vehicleName: name.slice(0, separator), operationName: name.slice(separator + 1) };
}

export type OperationNameResolution =
	| { readonly kind: "none" }
	| { readonly kind: "ambiguous"; readonly candidates: readonly string[] }
	| {
			readonly kind: "unique";
			readonly vehicleName: string;
			readonly operationName: string;
			readonly descriptor: VehicleManifestOperation;
	  };

/**
 * Resolves a tools_man name argument to exactly one operation against `operations` (already
 * namespaced, e.g. namespacedOperationsOf's own output) -- the shared logic behind both today's
 * fully-namespaced "vehicle:operation" lookup (unchanged: a direct match against the namespaced
 * name) and bare-name resolution (no ":" at all): search every vehicle's own operations for an
 * EXACT match on the bare operation name alone, mirroring bash's `type -a` -- show every binding
 * rather than silently pick one when more than one vehicle happens to expose the same operation
 * name. Zero matches and exactly one match behave identically whether the input was namespaced or
 * bare; only the ambiguous case is bare-name-specific (a fully-namespaced name is either the one
 * real operation or nothing at all -- there is nothing left to disambiguate).
 */
export function resolveOperationName(name: string, operations: readonly VehicleManifestOperation[]): OperationNameResolution {
	const split = splitNamespacedName(name);
	if (split) {
		const descriptor = operations.find((op) => op.name === name);
		return descriptor
			? { kind: "unique", vehicleName: split.vehicleName, operationName: split.operationName, descriptor }
			: { kind: "none" };
	}
	const matches = operations.flatMap((op) => {
		const opSplit = splitNamespacedName(op.name);
		return opSplit && opSplit.operationName === name ? [{ op, opSplit }] : [];
	});
	if (matches.length === 0) return { kind: "none" };
	if (matches.length > 1) return { kind: "ambiguous", candidates: matches.map((match) => match.op.name) };
	const only = matches[0]!;
	return { kind: "unique", vehicleName: only.opSplit.vehicleName, operationName: only.opSplit.operationName, descriptor: only.op };
}

export type OperationTypeResult =
	| { readonly status: "active"; readonly toolName: string; readonly weightTokens: number | undefined }
	| { readonly status: "dormant" }
	| { readonly status: "blocked"; readonly reason: string }
	| { readonly status: "unreachable"; readonly vehicleName: string }
	| { readonly status: "unknown" }
	| { readonly status: "ambiguous"; readonly candidates: readonly string[] };

/**
 * The `type`-equivalent classification behind tools_type -- read-only, never activates anything
 * or touches the TTL tracker's own state (unlike tools_man's resolution, which seeds/refreshes a
 * tool's TTL as a side effect of documenting it).
 *
 * - "active": already a real, currently-tracked Pi tool -- callable this turn, with its live
 *   toolName and its own estimated context weight in tokens (WeightedLruTracker.weightOf).
 * - "dormant": a known operation (live in `operations`) that tools_man hasn't activated (or has
 *   since been evicted under context pressure) -- calling tools_man on it would work right now.
 * - "blocked": known and pre-registered, but currently unavailable or blocked by safety policy --
 *   mirrors tools_man's own managed.available/managed.blocked distinction exactly, folded into one
 *   status with a distinguishing `reason` rather than reimplementing two parallel checks.
 * - "unreachable": a namespaced name whose vehicle prefix was previously known to this process
 *   (it appears in `managedTools` -- i.e. this process registered at least one of its operations
 *   at some point) but currently produces zero live operations at all -- the vehicle itself seems
 *   to have gone away, not just this one operation. Real motivating incident: Papyrus silently
 *   vanishing from discovery for an extended stretch, indistinguishable at the time from Papyrus
 *   never having existed at all. Deliberately narrower than "any name that ever existed": a BARE
 *   name with zero live matches is reported as "unknown", not "unreachable" -- there is no vehicle
 *   prefix to check history against, and guessing which of possibly several past vehicles the
 *   caller meant would be worse than an honest "not found".
 * - "unknown": no live vehicle currently produces this operation, and (for a namespaced name) its
 *   vehicle prefix was never known to this process either.
 * - "ambiguous": a bare name matching more than one vehicle's own operation -- see
 *   resolveOperationName's own doc comment.
 */
export function classifyOperationName(
	name: string,
	operations: readonly VehicleManifestOperation[],
	managedTools: readonly VehicleShellManagedTool[],
	tracker: WeightedLruTracker,
): OperationTypeResult {
	const resolved = resolveOperationName(name, operations);
	if (resolved.kind === "ambiguous") return { status: "ambiguous", candidates: resolved.candidates };
	if (resolved.kind === "unique") {
		const managed = managedTools.find((tool) => tool.vehicleName === resolved.vehicleName && tool.operationName === resolved.operationName);
		if (!managed) return { status: "dormant" };
		if (!managed.available) return { status: "blocked", reason: "currently unavailable" };
		if (managed.blocked) return { status: "blocked", reason: "blocked by the current safety policy" };
		if (tracker.isTracked(managed.toolName)) {
			return { status: "active", toolName: managed.toolName, weightTokens: tracker.weightOf(managed.toolName) };
		}
		return { status: "dormant" };
	}
	const split = splitNamespacedName(name);
	if (split) {
		const vehicleStillLive = operations.some((op) => splitNamespacedName(op.name)?.vehicleName === split.vehicleName);
		const vehiclePreviouslyKnown = managedTools.some((tool) => tool.vehicleName === split.vehicleName);
		if (!vehicleStillLive && vehiclePreviouslyKnown) return { status: "unreachable", vehicleName: split.vehicleName };
	}
	return { status: "unknown" };
}

/** One human-readable line per classifyOperationName result, for tools_type's own text output. */
export function formatOperationTypeLine(name: string, result: OperationTypeResult, manToolName: string, listToolName: string): string {
	switch (result.status) {
		case "active": {
			const weight = result.weightTokens !== undefined ? ` (~${result.weightTokens} token(s) of context)` : "";
			return `${name}: active -- callable now as ${result.toolName}${weight}.`;
		}
		case "dormant":
			return `${name}: dormant -- known, not yet activated. Call ${manToolName} on it to make it callable.`;
		case "blocked":
			return `${name}: blocked -- ${result.reason}.`;
		case "unreachable":
			return `${name}: unreachable -- vehicle "${result.vehicleName}" was previously known but produces no operations right now.`;
		case "unknown":
			return `${name}: unknown -- no such operation is currently discoverable. Use ${listToolName} to browse available names.`;
		case "ambiguous":
			return `${name}: ambiguous -- provided by ${result.candidates.length} vehicles (${result.candidates.join(", ")}). Use one of these exact names instead.`;
	}
}
