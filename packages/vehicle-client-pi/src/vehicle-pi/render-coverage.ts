/**
 * Opt-in renderer-coverage audit -- reports every manifest operation with no curated renderer
 * (falls back to the generic Vehicle renderer). Split out of vehicle-pi.ts's own bundled concerns
 * (Vehicle Pass 1 SRP audit finding #5).
 */

import type { VehicleManifest } from "@danypops/vehicle-core";
import type { RegisterVehicleToolsOptions } from "../vehicle-pi.js";

/** Default onGap: one console.warn line naming the vehicle and every gap operation, so an
 * un-audited operation is at minimum visible in whatever logs this process already writes
 * to, without requiring a consumer to supply its own logger just to see anything at all. */
function defaultRenderCoverageGapLogger(vehicleName: string, gaps: readonly string[]): void {
	console.warn(`[${vehicleName}] operation(s) with no curated renderer (falls back to the generic Vehicle fallback): ${gaps.join(", ")}`);
}

/** Never throws -- a coverage audit is a diagnostic, not a gate; a bug in the audit itself
 * must never prevent real registration from completing. */
export function reportRenderCoverageGaps(manifest: VehicleManifest, renderCoverage: RegisterVehicleToolsOptions["renderCoverage"]): void {
	if (!renderCoverage) return;
	try {
		const covered = new Set(renderCoverage.operations);
		const gaps = manifest.operations.map((operation) => operation.name).filter((name) => !covered.has(name));
		if (gaps.length > 0) (renderCoverage.onGap ?? defaultRenderCoverageGapLogger)(manifest.name, gaps);
	} catch {
		// A broken audit must never break real tool registration.
	}
}
