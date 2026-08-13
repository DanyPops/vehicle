import type {
	NativeOperationOutcome,
	NativeServiceController,
	NativeServiceDescriptor,
	NativeServiceStrategy,
	ReadinessProbe,
} from "../native/service-manager.js";
import { type Diagnostic, diagnostic } from "./diagnostic.js";
import type { ManifestHash, VehicleName } from "./identity.js";
import type { ArmadaManifest, VehicleSpec } from "./manifest.js";
import { type FleetPlan, type PlanOperation, planFleet } from "./planner.js";

export type ManifestHashReadOutcome =
	| { readonly ok: true; readonly hash: ManifestHash }
	| { readonly ok: false; readonly diagnostics: readonly Diagnostic[] };

export interface ReconcileRequest {
	readonly manifest: ArmadaManifest;
	readonly plan: FleetPlan;
	readonly strategy: NativeServiceStrategy;
	readonly controller: NativeServiceController;
	readonly readCurrentManifestHash: () => Promise<ManifestHashReadOutcome>;
	readonly readiness: ReadinessProbe;
}

export type ReconcileOutcome =
	| { readonly ok: true; readonly applied: readonly PlanOperation[]; readonly diagnostics: readonly Diagnostic[] }
	| { readonly ok: false; readonly diagnostics: readonly Diagnostic[] };

function failed(outcome: NativeOperationOutcome): ReconcileOutcome | undefined {
	return outcome.ok ? undefined : { ok: false, diagnostics: outcome.diagnostics };
}

async function startAndWait(
	controller: NativeServiceController,
	descriptor: NativeServiceDescriptor,
	vehicle: VehicleSpec,
	readiness: ReadinessProbe,
	diagnostics: Diagnostic[],
): Promise<ReconcileOutcome | undefined> {
	const started = await controller.start(descriptor.identity);
	const startFailure = failed(started);
	if (startFailure) return startFailure;
	diagnostics.push(...started.diagnostics);
	const ready = await readiness.waitUntilReady(vehicle);
	const readinessFailure = failed(ready);
	if (readinessFailure) return readinessFailure;
	diagnostics.push(...ready.diagnostics);
	return undefined;
}

type ApplyDependencies = Pick<ReconcileRequest, "controller" | "readiness">;

async function applyOperation(
	operation: PlanOperation,
	vehicle: VehicleSpec,
	descriptor: NativeServiceDescriptor,
	request: ApplyDependencies,
	diagnostics: Diagnostic[],
): Promise<ReconcileOutcome | undefined> {
	switch (operation.kind) {
		case "install": {
			const replaced = await request.controller.replaceDescriptorAtomically(descriptor);
			const failure = failed(replaced);
			if (failure) return failure;
			diagnostics.push(...replaced.diagnostics);
			return startAndWait(request.controller, descriptor, vehicle, request.readiness, diagnostics);
		}
		case "update": {
			const stopped = await request.controller.stop(descriptor.identity);
			const stopFailure = failed(stopped);
			if (stopFailure) return stopFailure;
			diagnostics.push(...stopped.diagnostics);
			const replaced = await request.controller.replaceDescriptorAtomically(descriptor);
			const replaceFailure = failed(replaced);
			if (replaceFailure) return replaceFailure;
			diagnostics.push(...replaced.diagnostics);
			return startAndWait(request.controller, descriptor, vehicle, request.readiness, diagnostics);
		}
		case "start":
			return startAndWait(request.controller, descriptor, vehicle, request.readiness, diagnostics);
		case "restart": {
			const stopped = await request.controller.stop(descriptor.identity);
			const failure = failed(stopped);
			if (failure) return failure;
			diagnostics.push(...stopped.diagnostics);
			return startAndWait(request.controller, descriptor, vehicle, request.readiness, diagnostics);
		}
		default: {
			const exhaustive: never = operation;
			return exhaustive;
		}
	}
}

function vehicleByName(manifest: ArmadaManifest, name: VehicleName): VehicleSpec | undefined {
	return manifest.vehicles.find((vehicle) => vehicle.name === name);
}

/**
 * Force one named Vehicle to stop+start now, bypassing plan/manifest-hash
 * staleness checks entirely. reconcileFleet only proposes a restart when the
 * declared spec or native state actually diverges -- a dependency bump
 * underneath a fixed interpreted entry point (e.g. `bun cli.ts serve`)
 * changes neither, so plan/reconcile alone can never recover from it. This is
 * the primitive a caller reaches for after an out-of-band update it knows
 * invalidated the running process, without waiting for the next drift.
 */
export async function restartVehicle(
	name: VehicleName,
	manifest: ArmadaManifest,
	strategy: NativeServiceStrategy,
	dependencies: ApplyDependencies,
): Promise<ReconcileOutcome> {
	const vehicle = vehicleByName(manifest, name);
	if (!vehicle) {
		return {
			ok: false,
			diagnostics: [diagnostic("RECONCILE_VEHICLE_MISSING", "error", `/vehicles/${name}`, "vehicle is not declared in the manifest")],
		};
	}
	const generated = strategy.generateDescriptor(vehicle);
	if (!generated.ok) return generated;
	const diagnostics: Diagnostic[] = [...generated.diagnostics];
	const operation: PlanOperation = { kind: "restart", name };
	const failure = await applyOperation(operation, vehicle, generated.descriptor, dependencies, diagnostics);
	if (failure) return failure;
	return { ok: true, applied: Object.freeze([operation]), diagnostics: Object.freeze(diagnostics) };
}

export async function reconcileFleet(request: ReconcileRequest): Promise<ReconcileOutcome> {
	if (request.strategy.kind !== request.controller.kind) {
		return {
			ok: false,
			diagnostics: [diagnostic("RECONCILE_MANAGER_MISMATCH", "error", "/", "descriptor strategy and native controller differ")],
		};
	}
	const currentManifest = await request.readCurrentManifestHash();
	if (!currentManifest.ok) return currentManifest;
	if (currentManifest.hash !== request.manifest.contentHash || request.plan.manifestHash !== request.manifest.contentHash) {
		return { ok: false, diagnostics: [diagnostic("RECONCILE_MANIFEST_STALE", "error", "/", "manifest changed after planning")] };
	}
	const inspected = await request.controller.inspect(request.manifest.vehicles);
	if (!inspected.ok) return inspected;
	const currentPlan = planFleet(request.manifest, inspected.services, request.strategy);
	if (!currentPlan.ok) return currentPlan;
	if (currentPlan.plan.planHash !== request.plan.planHash) {
		return { ok: false, diagnostics: [diagnostic("RECONCILE_PLAN_STALE", "error", "/", "native state changed after planning")] };
	}
	const diagnostics: Diagnostic[] = [...inspected.diagnostics];
	const applied: PlanOperation[] = [];
	for (const operation of request.plan.operations) {
		const vehicle = vehicleByName(request.manifest, operation.name);
		if (!vehicle) {
			return {
				ok: false,
				diagnostics: [diagnostic("RECONCILE_VEHICLE_MISSING", "error", `/vehicles/${operation.name}`, "plan vehicle is absent")],
			};
		}
		const generated = request.strategy.generateDescriptor(vehicle);
		if (!generated.ok) return generated;
		diagnostics.push(...generated.diagnostics);
		const failure = await applyOperation(operation, vehicle, generated.descriptor, request, diagnostics);
		if (failure) return failure;
		applied.push(operation);
	}
	return { ok: true, applied: Object.freeze(applied), diagnostics: Object.freeze(diagnostics) };
}
