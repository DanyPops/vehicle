/**
 * TDD: written before src/project-scope.ts exists.
 *
 * Extracted from Papyrus's own domain/project-registry.ts + task-scope.ts after Pipes needed the
 * identical "which project does this belong to, with an 'All projects' fallback" shape for a
 * second, independent purpose (grouping subscribed CI jobs), the same "confirmed twice, extract
 * it" bar this package's other modules were built past.
 */
import { describe, expect, it } from "bun:test";
import {
	findVehicleProject,
	registerVehicleProject,
	type VehicleProject,
	type VehicleProjectStore,
	vehicleProjectScopeLabel,
} from "../src/project-scope.ts";

function inMemoryStore(): VehicleProjectStore & { all(): VehicleProject[] } {
	const rows = new Map<string, VehicleProject>();
	return {
		findByRoot: (projectRoot) => rows.get(projectRoot),
		upsert: (project) => void rows.set(project.projectRoot, project),
		all: () => [...rows.values()],
	};
}

describe("registerVehicleProject", () => {
	it("creates a new project defaulting its name to the root's own basename", () => {
		const store = inMemoryStore();
		const project = registerVehicleProject(store, { projectRoot: "/home/x/pipes" }, () => "2020-01-01T00:00:00.000Z");
		expect(project).toEqual({
			id: project.id,
			name: "pipes",
			projectRoot: "/home/x/pipes",
			createdAt: "2020-01-01T00:00:00.000Z",
			updatedAt: "2020-01-01T00:00:00.000Z",
		});
		expect(store.findByRoot("/home/x/pipes")).toEqual(project);
	});

	it("honors an explicit name over the basename default", () => {
		const store = inMemoryStore();
		const project = registerVehicleProject(store, { projectRoot: "/home/x/pipes", name: "Pipes CI" });
		expect(project.name).toBe("Pipes CI");
	});

	it("is idempotent by root -- a second call finds and updates the same project, same id, fresh updatedAt", () => {
		const store = inMemoryStore();
		const first = registerVehicleProject(store, { projectRoot: "/home/x/pipes" }, () => "2020-01-01T00:00:00.000Z");
		const second = registerVehicleProject(store, { projectRoot: "/home/x/pipes" }, () => "2020-06-01T00:00:00.000Z");

		expect(second.id).toBe(first.id);
		expect(second.createdAt).toBe("2020-01-01T00:00:00.000Z");
		expect(second.updatedAt).toBe("2020-06-01T00:00:00.000Z");
		expect(store.all()).toHaveLength(1);
	});

	it("lets a later call rename an existing project by root", () => {
		const store = inMemoryStore();
		registerVehicleProject(store, { projectRoot: "/home/x/pipes" });
		const renamed = registerVehicleProject(store, { projectRoot: "/home/x/pipes", name: "Pipes CI" });
		expect(renamed.name).toBe("Pipes CI");
		expect(store.all()).toHaveLength(1);
	});

	it("registers two different roots as two independent projects", () => {
		const store = inMemoryStore();
		registerVehicleProject(store, { projectRoot: "/home/x/pipes" });
		registerVehicleProject(store, { projectRoot: "/home/x/vehicle" });
		expect(
			store
				.all()
				.map((p) => p.projectRoot)
				.sort(),
		).toEqual(["/home/x/pipes", "/home/x/vehicle"]);
	});
});

describe("findVehicleProject", () => {
	it("returns undefined for a root that was never registered", () => {
		const store = inMemoryStore();
		expect(findVehicleProject(store, "/home/x/never-seen")).toBeUndefined();
	});

	it("returns the registered project for a known root", () => {
		const store = inMemoryStore();
		const project = registerVehicleProject(store, { projectRoot: "/home/x/pipes" });
		expect(findVehicleProject(store, "/home/x/pipes")).toEqual(project);
	});
});

describe("vehicleProjectScopeLabel", () => {
	it("falls back to 'All projects' when no projectRoot is given at all", () => {
		const store = inMemoryStore();
		expect(vehicleProjectScopeLabel(store, undefined)).toBe("All projects");
	});

	it("falls back to 'All projects' for a projectRoot that was never registered -- unlike a raw basename() this never invents a phantom label", () => {
		const store = inMemoryStore();
		expect(vehicleProjectScopeLabel(store, "/home/x/never-registered")).toBe("All projects");
	});

	it("returns the registered project's own name for a known root", () => {
		const store = inMemoryStore();
		registerVehicleProject(store, { projectRoot: "/home/x/pipes", name: "Pipes CI" });
		expect(vehicleProjectScopeLabel(store, "/home/x/pipes")).toBe("Pipes CI");
	});
});
