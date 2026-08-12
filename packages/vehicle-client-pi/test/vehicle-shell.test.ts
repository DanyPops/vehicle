import { describe, expect, it } from "bun:test";
import type { VehicleManifestOperation } from "@danypops/vehicle-core";
import { formatOperationManPage, formatOperationOneLiner, matchesShellQuery, VehicleShellTtlTracker } from "../src/vehicle-shell.ts";

const limits = { defaultTimeoutMs: 1_000, maxTimeoutMs: 5_000, maxRequestBytes: 1_024, maxResponseBytes: 1_024 };

function descriptor(overrides: Partial<VehicleManifestOperation> = {}): VehicleManifestOperation {
	return {
		name: "tasks.depend",
		version: 1,
		available: true,
		description: "Adds a dependency edge between two tasks.",
		inputSchema: {
			type: "object",
			properties: {
				id: { type: "string", description: "The dependent task's id." },
				dependency_name: { type: "string" },
			},
			required: ["id"],
		},
		outputSchema: { type: "object" },
		permissions: [],
		effect: "local-write",
		idempotency: { mode: "safe" },
		streaming: false,
		longRunning: false,
		limits,
		errors: [],
		...overrides,
	};
}

describe("formatOperationOneLiner", () => {
	it("joins the operation name and description on one line", () => {
		expect(formatOperationOneLiner(descriptor())).toBe("tasks.depend -- Adds a dependency edge between two tasks.");
	});

	it("annotates a currently-unavailable operation with its reason", () => {
		expect(formatOperationOneLiner(descriptor({ available: false, unavailableReason: "missing credential" }))).toBe(
			"tasks.depend -- Adds a dependency edge between two tasks. (currently unavailable: missing credential)",
		);
	});

	it("annotates a currently-unavailable operation with no reason given", () => {
		expect(formatOperationOneLiner(descriptor({ available: false }))).toBe(
			"tasks.depend -- Adds a dependency edge between two tasks. (currently unavailable)",
		);
	});

	it("does not annotate an explicitly available operation", () => {
		expect(formatOperationOneLiner(descriptor({ available: true }))).toBe("tasks.depend -- Adds a dependency edge between two tasks.");
	});
});

describe("matchesShellQuery", () => {
	it("matches a substring of the operation name, case-insensitively", () => {
		expect(matchesShellQuery(descriptor(), "TASKS.dep")).toBe(true);
	});

	it("matches a substring of the description too", () => {
		expect(matchesShellQuery(descriptor(), "dependency edge")).toBe(true);
	});

	it("returns false for a query matching neither", () => {
		expect(matchesShellQuery(descriptor(), "nonexistent")).toBe(false);
	});

	it("treats an empty or whitespace-only query as matching everything", () => {
		expect(matchesShellQuery(descriptor(), "")).toBe(true);
		expect(matchesShellQuery(descriptor(), "   ")).toBe(true);
	});
});

describe("formatOperationManPage", () => {
	// Every field: tool name, operation name/version, description, effect, permissions, idempotency.
	it("includes every field a man page needs", () => {
		const page = formatOperationManPage(descriptor(), "tasks_depend");
		expect(page).toContain("tasks_depend (tasks.depend, v1)");
		expect(page).toContain("Adds a dependency edge between two tasks.");
		expect(page).toContain("effect: local-write");
		expect(page).toContain("permissions: none");
		expect(page).toContain("idempotency: safe");
	});

	it("lists each schema property with its type and required/optional marker", () => {
		const page = formatOperationManPage(descriptor(), "tasks_depend");
		expect(page).toContain("id (string, required): The dependent task's id.");
		expect(page).toContain("dependency_name (string, optional)");
	});

	it("names granted permissions when present", () => {
		const page = formatOperationManPage(descriptor({ permissions: ["tasks:write"] }), "tasks_depend");
		expect(page).toContain("permissions: tasks:write");
	});

	it("shows a placeholder for an operation with no declared parameters", () => {
		const page = formatOperationManPage(descriptor({ inputSchema: { type: "object" } }), "tasks_depend");
		expect(page).toContain("(none)");
	});

	it("documents a patternProperties-shaped free-form map the same way as additionalProperties-as-schema", () => {
		// A free-form string-keyed map (e.g. Papyrus's tasks.create checklist) uses patternProperties
		// rather than additionalProperties-as-schema so a client-side JSON-Schema validator (TypeBox's
		// own Value.Errors()) can descend into the real nested violation instead of only reporting a
		// generic top-level "must not have additional properties" -- tools_man's own documentation of
		// that shape must stay unchanged either way.
		const page = formatOperationManPage(
			descriptor({
				inputSchema: {
					type: "object",
					properties: {
						checklist: {
							type: "object",
							patternProperties: {
								"^.*$": {
									type: "object",
									properties: { proof: { type: "array", minItems: 1 } },
									required: ["proof"],
								},
							},
						},
					},
				},
			}),
			"tasks_create",
		);
		expect(page).toContain("checklist (object, optional)");
		expect(page).toContain("values (object)");
		expect(page).toContain("proof (array, required; minItems: 1)");
	});
});

describe("VehicleShellTtlTracker", () => {
	it("tracks a seeded tool as active until its TTL decays to zero", () => {
		const tracker = new VehicleShellTtlTracker();
		tracker.seed("tasks_create", 2);
		expect(tracker.trackedNames()).toEqual(["tasks_create"]);

		expect(tracker.tick().evicted).toEqual([]);
		expect(tracker.trackedNames()).toEqual(["tasks_create"]);

		expect(tracker.tick().evicted).toEqual(["tasks_create"]);
		expect(tracker.trackedNames()).toEqual([]);
	});

	// A call during a turn refreshes to full TTL, not merely skips one decrement.
	it("refreshes a tool's TTL back to its starting value when it's called during a turn", () => {
		const tracker = new VehicleShellTtlTracker();
		tracker.seed("tasks_create", 3);

		tracker.tick(); // 3 -> 2, not called
		tracker.recordCall("tasks_create");
		tracker.tick(); // called -> refreshed to 3, not just held at 2

		// From full 3 again, it now survives two more silent ticks before eviction on the third.
		expect(tracker.tick().evicted).toEqual([]);
		expect(tracker.tick().evicted).toEqual([]);
		expect(tracker.tick().evicted).toEqual(["tasks_create"]);
	});

	it("recordCall is a no-op for a name the tracker never seeded (e.g. the always-on meta-tools)", () => {
		const tracker = new VehicleShellTtlTracker();
		tracker.recordCall("tools_list");
		expect(tracker.tick().evicted).toEqual([]);
		expect(tracker.trackedNames()).toEqual([]);
	});

	// Resets immediately, not just on the next tick.
	it("re-seeding an already-tracked tool (a repeat tools_man call) resets it to full TTL", () => {
		const tracker = new VehicleShellTtlTracker();
		tracker.seed("tasks_depend", 2);
		tracker.tick(); // 2 -> 1

		tracker.seed("tasks_depend", 2); // re-seeded back to full before it would have been evicted
		expect(tracker.tick().evicted).toEqual([]); // 2 -> 1, still alive
		expect(tracker.tick().evicted).toEqual(["tasks_depend"]); // 1 -> 0, evicted now
	});

	it("tracks several tools independently -- one's calls never refresh another's TTL", () => {
		const tracker = new VehicleShellTtlTracker();
		tracker.seed("a", 2);
		tracker.seed("b", 2);
		tracker.recordCall("a");
		expect(tracker.tick().evicted).toEqual([]);
		expect(tracker.tick().evicted).toEqual(["b"]);
		expect(tracker.trackedNames()).toEqual(["a"]);
	});

	it("isTracked reflects live membership, including after eviction", () => {
		const tracker = new VehicleShellTtlTracker();
		tracker.seed("tasks_create", 1);
		expect(tracker.isTracked("tasks_create")).toBe(true);
		tracker.tick();
		expect(tracker.isTracked("tasks_create")).toBe(false);
	});
});
