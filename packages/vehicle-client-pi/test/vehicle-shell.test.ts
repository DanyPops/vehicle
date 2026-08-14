import { describe, expect, it } from "bun:test";
import type { VehicleManifestOperation } from "@danypops/vehicle-core";
import {
	classifyOperationName,
	formatOperationManPage,
	formatOperationOneLiner,
	formatOperationTypeLine,
	matchesShellQuery,
	relatedOperationNames,
	resolveOperationName,
	type VehicleShellManagedTool,
	VehicleShellTtlTracker,
} from "../src/vehicle-shell.ts";

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

	it("appends a see also line naming every related operation, when given any", () => {
		const page = formatOperationManPage(descriptor(), "tasks_depend", ["papyrus:tasks.contain", "papyrus:tasks.create"]);
		expect(page).toContain("see also: papyrus:tasks.contain, papyrus:tasks.create");
	});

	it("omits the see also section entirely (not an empty line) when there's nothing related", () => {
		const page = formatOperationManPage(descriptor(), "tasks_depend");
		expect(page).not.toContain("see also");
		expect(page).not.toContain("see also:");
	});
});

describe("relatedOperationNames", () => {
	function namespaced(vehicleName: string, opName: string): VehicleManifestOperation {
		return descriptor({ name: `${vehicleName}:${opName}` });
	}

	it("finds every other operation from the same vehicle sharing the same dot-separated namespace prefix", () => {
		const related = relatedOperationNames("papyrus", "tasks.create", [
			namespaced("papyrus", "tasks.create"),
			namespaced("papyrus", "tasks.depend"),
			namespaced("papyrus", "tasks.contain"),
			namespaced("papyrus", "docs.create"),
		]);
		expect(related).toEqual(["papyrus:tasks.depend", "papyrus:tasks.contain"]);
	});

	it("never includes the operation itself", () => {
		const related = relatedOperationNames("papyrus", "tasks.create", [namespaced("papyrus", "tasks.create")]);
		expect(related).toEqual([]);
	});

	it("never crosses vehicles, even for the identical operation namespace prefix", () => {
		const related = relatedOperationNames("papyrus", "tasks.create", [namespaced("pipes", "tasks.depend")]);
		expect(related).toEqual([]);
	});

	it("an operation name with no dot at all (no namespace prefix) has nothing to relate it to", () => {
		const related = relatedOperationNames("papyrus", "flatname", [namespaced("papyrus", "flatname"), namespaced("papyrus", "flatname2")]);
		expect(related).toEqual([]);
	});

	it("is bounded, never dominating the page for a vehicle with a huge flat tasks.* namespace", () => {
		const everyTaskOperation = Array.from({ length: 20 }, (_, index) => namespaced("papyrus", `tasks.op${index}`));
		const related = relatedOperationNames("papyrus", "tasks.create", everyTaskOperation);
		expect(related.length).toBe(5);
	});
});

describe("resolveOperationName", () => {
	function namespaced(vehicleName: string, opName: string): VehicleManifestOperation {
		return descriptor({ name: `${vehicleName}:${opName}` });
	}

	it("a fully-namespaced name resolves directly, exactly as today", () => {
		const resolved = resolveOperationName("papyrus:tasks.depend", [namespaced("papyrus", "tasks.depend")]);
		expect(resolved).toEqual({
			kind: "unique",
			vehicleName: "papyrus",
			operationName: "tasks.depend",
			descriptor: namespaced("papyrus", "tasks.depend"),
		});
	});

	it("a fully-namespaced name with no matching operation resolves to none", () => {
		expect(resolveOperationName("papyrus:nonexistent", [namespaced("papyrus", "tasks.depend")])).toEqual({ kind: "none" });
	});

	it("a bare name with exactly one owning vehicle resolves the same as if it had been namespaced", () => {
		const resolved = resolveOperationName("tasks.depend", [namespaced("papyrus", "tasks.depend"), namespaced("papyrus", "docs.create")]);
		expect(resolved).toEqual({
			kind: "unique",
			vehicleName: "papyrus",
			operationName: "tasks.depend",
			descriptor: namespaced("papyrus", "tasks.depend"),
		});
	});

	it("a bare name matching zero operations resolves to none", () => {
		expect(resolveOperationName("nonexistent", [namespaced("papyrus", "tasks.depend")])).toEqual({ kind: "none" });
	});

	it("a bare name matching more than one vehicle's own operation resolves to every real candidate, never picking one", () => {
		const resolved = resolveOperationName("docs.create", [namespaced("papyrus", "docs.create"), namespaced("web-spider", "docs.create")]);
		expect(resolved).toEqual({ kind: "ambiguous", candidates: ["papyrus:docs.create", "web-spider:docs.create"] });
	});
});

describe("classifyOperationName", () => {
	function namespaced(vehicleName: string, opName: string): VehicleManifestOperation {
		return descriptor({ name: `${vehicleName}:${opName}` });
	}
	function managedTool(overrides: Partial<VehicleShellManagedTool> = {}): VehicleShellManagedTool {
		return {
			vehicleName: "papyrus",
			toolName: "tasks_depend",
			operationName: "tasks.depend",
			available: true,
			blocked: false,
			...overrides,
		};
	}

	it("active: already tracked -- reports its real toolName and remaining TTL", () => {
		const tracker = new VehicleShellTtlTracker();
		tracker.seed("tasks_depend", 5);
		const result = classifyOperationName("papyrus:tasks.depend", [namespaced("papyrus", "tasks.depend")], [managedTool()], tracker);
		expect(result).toEqual({ status: "active", toolName: "tasks_depend", remainingTtlTurns: 5 });
	});

	it("dormant: known and pre-registered, but not currently tracked", () => {
		const tracker = new VehicleShellTtlTracker();
		const result = classifyOperationName("papyrus:tasks.depend", [namespaced("papyrus", "tasks.depend")], [managedTool()], tracker);
		expect(result).toEqual({ status: "dormant" });
	});

	it("dormant: known live but never pre-registered at all (a genuinely cross-process-only vehicle)", () => {
		const tracker = new VehicleShellTtlTracker();
		const result = classifyOperationName("papyrus:tasks.depend", [namespaced("papyrus", "tasks.depend")], [], tracker);
		expect(result).toEqual({ status: "dormant" });
	});

	it("blocked: pre-registered but currently unavailable", () => {
		const tracker = new VehicleShellTtlTracker();
		const result = classifyOperationName(
			"papyrus:tasks.depend",
			[namespaced("papyrus", "tasks.depend")],
			[managedTool({ available: false })],
			tracker,
		);
		expect(result).toEqual({ status: "blocked", reason: "currently unavailable" });
	});

	it("blocked: pre-registered but blocked by the current safety policy", () => {
		const tracker = new VehicleShellTtlTracker();
		const result = classifyOperationName(
			"papyrus:tasks.depend",
			[namespaced("papyrus", "tasks.depend")],
			[managedTool({ blocked: true })],
			tracker,
		);
		expect(result).toEqual({ status: "blocked", reason: "blocked by the current safety policy" });
	});

	it("unreachable: a namespaced name whose vehicle was previously known but produces nothing live now", () => {
		const tracker = new VehicleShellTtlTracker();
		// papyrus produced tasks.depend at some point (still in managedTools), but the live operations
		// list (as namespacedOperationsOf would return right now) has nothing from papyrus at all.
		const result = classifyOperationName("papyrus:tasks.depend", [namespaced("pipes", "ci.status")], [managedTool()], tracker);
		expect(result).toEqual({ status: "unreachable", vehicleName: "papyrus" });
	});

	it("unknown: a namespaced name whose vehicle was never known at all", () => {
		const tracker = new VehicleShellTtlTracker();
		const result = classifyOperationName("nonexistent:tasks.depend", [namespaced("pipes", "ci.status")], [], tracker);
		expect(result).toEqual({ status: "unknown" });
	});

	it("unknown: a bare name matching nothing live, even if some other vehicle was previously known", () => {
		const tracker = new VehicleShellTtlTracker();
		const result = classifyOperationName("nonexistent", [namespaced("pipes", "ci.status")], [managedTool()], tracker);
		expect(result).toEqual({ status: "unknown" });
	});

	it("ambiguous: a bare name matching more than one vehicle's own operation", () => {
		const tracker = new VehicleShellTtlTracker();
		const result = classifyOperationName(
			"docs.create",
			[namespaced("papyrus", "docs.create"), namespaced("web-spider", "docs.create")],
			[],
			tracker,
		);
		expect(result).toEqual({ status: "ambiguous", candidates: ["papyrus:docs.create", "web-spider:docs.create"] });
	});

	it("is read-only -- never mutates the tracker's own state", () => {
		const tracker = new VehicleShellTtlTracker();
		classifyOperationName("papyrus:tasks.depend", [namespaced("papyrus", "tasks.depend")], [managedTool()], tracker);
		expect(tracker.trackedNames()).toEqual([]);
	});
});

describe("formatOperationTypeLine", () => {
	it("formats every status as a single, clear line", () => {
		expect(
			formatOperationTypeLine(
				"papyrus:tasks.depend",
				{ status: "active", toolName: "tasks_depend", remainingTtlTurns: 3 },
				"tools_man",
				"tools_list",
			),
		).toBe("papyrus:tasks.depend: active -- callable now as tasks_depend (3 turn(s) remaining before it decays).");
		expect(formatOperationTypeLine("papyrus:tasks.depend", { status: "dormant" }, "tools_man", "tools_list")).toBe(
			"papyrus:tasks.depend: dormant -- known, not yet activated. Call tools_man on it to make it callable.",
		);
		expect(
			formatOperationTypeLine("papyrus:tasks.depend", { status: "blocked", reason: "currently unavailable" }, "tools_man", "tools_list"),
		).toBe("papyrus:tasks.depend: blocked -- currently unavailable.");
		expect(
			formatOperationTypeLine("papyrus:tasks.depend", { status: "unreachable", vehicleName: "papyrus" }, "tools_man", "tools_list"),
		).toBe('papyrus:tasks.depend: unreachable -- vehicle "papyrus" was previously known but produces no operations right now.');
		expect(formatOperationTypeLine("nonexistent", { status: "unknown" }, "tools_man", "tools_list")).toBe(
			"nonexistent: unknown -- no such operation is currently discoverable. Use tools_list to browse available names.",
		);
		expect(
			formatOperationTypeLine(
				"docs.create",
				{ status: "ambiguous", candidates: ["papyrus:docs.create", "web-spider:docs.create"] },
				"tools_man",
				"tools_list",
			),
		).toBe(
			"docs.create: ambiguous -- provided by 2 vehicles (papyrus:docs.create, web-spider:docs.create). Use one of these exact names instead.",
		);
	});

	it("omits the TTL parenthetical when remainingTtlTurns is unknown", () => {
		expect(
			formatOperationTypeLine(
				"papyrus:tasks.depend",
				{ status: "active", toolName: "tasks_depend", remainingTtlTurns: undefined },
				"tools_man",
				"tools_list",
			),
		).toBe("papyrus:tasks.depend: active -- callable now as tasks_depend.");
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
