import { describe, expect, it } from "bun:test";
import { buildToolboxReminderMessage, ToolboxReminderTracker } from "../src/vehicle-shell/toolbox-reminder.ts";

describe("ToolboxReminderTracker", () => {
	describe("turn-based threshold", () => {
		it("never reports due before the configured turn threshold", () => {
			const tracker = new ToolboxReminderTracker({ minTurnsSinceInactive: 3, minMsSinceInactive: Number.POSITIVE_INFINITY });
			tracker.recordInactive("tasks_create", "papyrus:tasks.create");
			expect(tracker.tick().due).toEqual([]);
			expect(tracker.tick().due).toEqual([]);
		});

		it("reports due exactly once it crosses the turn threshold", () => {
			const tracker = new ToolboxReminderTracker({ minTurnsSinceInactive: 3, minMsSinceInactive: Number.POSITIVE_INFINITY });
			tracker.recordInactive("tasks_create", "papyrus:tasks.create");
			tracker.tick();
			tracker.tick();
			const third = tracker.tick();
			expect(third.due).toEqual([{ toolName: "tasks_create", label: "papyrus:tasks.create" }]);
		});

		it("is one-shot -- never reports the same episode twice", () => {
			const tracker = new ToolboxReminderTracker({ minTurnsSinceInactive: 1, minMsSinceInactive: Number.POSITIVE_INFINITY });
			tracker.recordInactive("tasks_create", "papyrus:tasks.create");
			expect(tracker.tick().due.length).toBe(1);
			expect(tracker.tick().due).toEqual([]);
			expect(tracker.tick().due).toEqual([]);
		});
	});

	describe("wall-clock threshold", () => {
		it("never reports due before the configured wall-clock threshold", () => {
			let now = 1_000;
			const tracker = new ToolboxReminderTracker({
				minTurnsSinceInactive: Number.POSITIVE_INFINITY,
				minMsSinceInactive: 10_000,
				now: () => now,
			});
			tracker.recordInactive("tasks_create", "papyrus:tasks.create");
			now += 5_000;
			expect(tracker.tick().due).toEqual([]);
		});

		it("reports due once the wall-clock threshold is crossed, even on turn 1", () => {
			let now = 1_000;
			const tracker = new ToolboxReminderTracker({
				minTurnsSinceInactive: Number.POSITIVE_INFINITY,
				minMsSinceInactive: 10_000,
				now: () => now,
			});
			tracker.recordInactive("tasks_create", "papyrus:tasks.create");
			now += 10_000;
			expect(tracker.tick().due).toEqual([{ toolName: "tasks_create", label: "papyrus:tasks.create" }]);
		});

		it("fires on whichever configured threshold is crossed first", () => {
			let now = 1_000;
			const tracker = new ToolboxReminderTracker({ minTurnsSinceInactive: 100, minMsSinceInactive: 5_000, now: () => now });
			tracker.recordInactive("tasks_create", "papyrus:tasks.create");
			now += 5_000; // wall-clock threshold crossed well before 100 turns
			expect(tracker.tick().due.length).toBe(1);
		});
	});

	describe("recordActive clears an in-progress episode", () => {
		it("a tool reactivated before the threshold is never reported", () => {
			const tracker = new ToolboxReminderTracker({ minTurnsSinceInactive: 3, minMsSinceInactive: Number.POSITIVE_INFINITY });
			tracker.recordInactive("tasks_create", "papyrus:tasks.create");
			tracker.tick();
			tracker.recordActive("tasks_create");
			tracker.tick();
			tracker.tick();
			expect(tracker.tick().due).toEqual([]);
		});

		it("a later re-inactive episode starts its own fresh clock, not the old one's", () => {
			const tracker = new ToolboxReminderTracker({ minTurnsSinceInactive: 3, minMsSinceInactive: Number.POSITIVE_INFINITY });
			tracker.recordInactive("tasks_create", "papyrus:tasks.create");
			tracker.tick(); // turn 1
			tracker.tick(); // turn 2
			tracker.recordActive("tasks_create");
			tracker.recordInactive("tasks_create", "papyrus:tasks.create"); // fresh episode at turn 2
			expect(tracker.tick().due).toEqual([]); // turn 3: only 1 turn into the new episode
			expect(tracker.tick().due).toEqual([]); // turn 4: only 2 turns in
			expect(tracker.tick().due.length).toBe(1); // turn 5: 3 turns in, fresh episode's own threshold
		});

		it("recordActive is a no-op for a name never tracked", () => {
			const tracker = new ToolboxReminderTracker();
			expect(() => tracker.recordActive("nothing_tracked")).not.toThrow();
			expect(tracker.size()).toBe(0);
		});
	});

	describe("idempotent recordInactive", () => {
		it("a repeat recordInactive call for an already-tracked name never resets its clock", () => {
			const tracker = new ToolboxReminderTracker({ minTurnsSinceInactive: 3, minMsSinceInactive: Number.POSITIVE_INFINITY });
			tracker.recordInactive("tasks_create", "papyrus:tasks.create");
			tracker.tick(); // turn 1
			tracker.recordInactive("tasks_create", "papyrus:tasks.create"); // must not reset
			tracker.tick(); // turn 2
			expect(tracker.tick().due.length).toBe(1); // turn 3 -- exactly as if the repeat call never happened
		});
	});

	describe("capacity bound", () => {
		it("evicts the oldest-tracked candidate once at capacity, never throws", () => {
			const tracker = new ToolboxReminderTracker({ maxTrackedCandidates: 2 });
			tracker.recordInactive("a", "vehicle:a");
			tracker.recordInactive("b", "vehicle:b");
			expect(() => tracker.recordInactive("c", "vehicle:c")).not.toThrow();
			expect(tracker.size()).toBe(2);
			// "a" was oldest -- dropped to make room for "c".
			const tracker2 = new ToolboxReminderTracker({ maxTrackedCandidates: 2, minTurnsSinceInactive: 1 });
			tracker2.recordInactive("a", "vehicle:a");
			tracker2.recordInactive("b", "vehicle:b");
			tracker2.recordInactive("c", "vehicle:c");
			const due = tracker2.tick().due.map((candidate) => candidate.toolName);
			expect(due.sort()).toEqual(["b", "c"]);
		});
	});

	describe("multiple due candidates combined in one tick", () => {
		it("reports every candidate that crosses the threshold in the same tick together", () => {
			const tracker = new ToolboxReminderTracker({ minTurnsSinceInactive: 2, minMsSinceInactive: Number.POSITIVE_INFINITY });
			tracker.recordInactive("a", "vehicle:a");
			tracker.recordInactive("b", "vehicle:b");
			tracker.tick(); // turn 1
			const due = tracker.tick().due.map((candidate) => candidate.toolName); // turn 2 -- both due together
			expect(due.sort()).toEqual(["a", "b"]);
		});
	});
});

describe("buildToolboxReminderMessage", () => {
	it("formats a single candidate with singular phrasing", () => {
		const message = buildToolboxReminderMessage([{ toolName: "tasks_create", label: "papyrus:tasks.create" }], "tools_man");
		expect(message).toContain("papyrus:tasks.create");
		expect(message).toContain("this was evicted");
		expect(message).toContain("tools_man");
	});

	it("formats multiple candidates with plural phrasing, combined into one message", () => {
		const message = buildToolboxReminderMessage(
			[
				{ toolName: "tasks_create", label: "papyrus:tasks.create" },
				{ toolName: "web_fetch", label: "web-spider:web.fetch" },
			],
			"tools_man",
		);
		expect(message).toContain("papyrus:tasks.create, web-spider:web.fetch");
		expect(message).toContain("these were evicted");
	});
});
