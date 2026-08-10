/**
 * A generic "which project does this call belong to" identity + resolution, extracted from
 * Papyrus's own domain/project-registry.ts + task-scope.ts (papyrus's own Task/Doc/Rule/Playbook
 * artifacts already shared one Project identity internally -- "shared across every artifact kind
 * ... rather than owned by Tasks alone") once Pipes needed the identical shape for a second,
 * independent purpose: grouping subscribed CI jobs by the project that subscribed to them, the
 * same way Papyrus's own Task widget already groups by project ("Tasks · pipes" vs
 * "Tasks · All projects").
 *
 * Deliberately storage-agnostic, same convention as session-identity.ts: this module owns the
 * domain shape and resolution logic, not any particular SQL schema -- each consuming daemon
 * persists VehicleProject however its own storage layer already works.
 *
 * Deliberately NOT ported from Papyrus: alias-based fuzzy reference resolution and Papyrus's own
 * TaskViewMode ("project" | "graph" | "all", where "graph" is a Task-specific focused-subtree
 * view) -- both are genuinely Papyrus's own richer, human-typed-reference CLI surface, not yet
 * needed by a second consumer. A consumer that grows the same need can still layer it on top of
 * this shared identity without this module needing to grow it speculatively first.
 */
import { randomUUID } from "node:crypto";
import { basename } from "node:path";

export interface VehicleProject {
	readonly id: string;
	readonly name: string;
	readonly projectRoot: string;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface RegisterVehicleProjectInput {
	readonly projectRoot: string;
	readonly name?: string;
}

/** Storage port a consuming daemon implements against its own persistence layer. */
export interface VehicleProjectStore {
	findByRoot(projectRoot: string): VehicleProject | undefined;
	upsert(project: VehicleProject): void;
}

/**
 * Finds or creates (find-or-create by projectRoot, updating name/updatedAt on repeat calls) the
 * Project for a given root. Idempotent and safe to call on every request that carries a
 * caller-supplied project root -- e.g. once per Vehicle invocation via VehicleOperationContext's
 * own callerProjectRoot (see vehicle-core's own doc comment) -- unlike Papyrus's own Task domain,
 * where explicit registration is a deliberate choice (Tasks' own rich CLI/reference surface makes
 * an unbounded number of auto-registered one-off projects unwelcome noise); a lighter caller
 * (e.g. a CI-job subscription) auto-registering on first sight is a reasonable, much cheaper
 * default -- a consumer that wants Papyrus's own explicit-registration-only policy simply never
 * calls this except from its own explicit "register" operation.
 */
export function registerVehicleProject(
	store: VehicleProjectStore,
	input: RegisterVehicleProjectInput,
	now: () => string = () => new Date().toISOString(),
): VehicleProject {
	const existing = store.findByRoot(input.projectRoot);
	const timestamp = now();
	const project: VehicleProject = {
		id: existing?.id ?? randomUUID(),
		name: input.name?.trim() || existing?.name || basename(input.projectRoot) || input.projectRoot,
		projectRoot: input.projectRoot,
		createdAt: existing?.createdAt ?? timestamp,
		updatedAt: timestamp,
	};
	store.upsert(project);
	return project;
}

export function findVehicleProject(store: VehicleProjectStore, projectRoot: string): VehicleProject | undefined {
	return store.findByRoot(projectRoot);
}

/**
 * Same "All projects" fallback convention as Papyrus's own taskScopeLabel(): a registered
 * project's own name when one exists for this root, "All projects" when the root is missing or
 * was never registered here -- e.g. a session's cwd that never called registerVehicleProject
 * (mirrors Papyrus's own "~" home-directory session never resolving to a named project). Never
 * falls back to a raw basename() of an unregistered root -- that would invent a phantom
 * per-directory label for every incidental cwd instead of grouping it into the shared default.
 */
export function vehicleProjectScopeLabel(store: VehicleProjectStore, projectRoot: string | undefined): string {
	if (!projectRoot) return "All projects";
	return store.findByRoot(projectRoot)?.name ?? "All projects";
}
