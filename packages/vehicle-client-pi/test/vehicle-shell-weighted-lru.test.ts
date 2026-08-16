import { describe, expect, it } from "bun:test";
import { WeightedLruTracker } from "../src/vehicle-shell/weighted-lru.ts";

describe("WeightedLruTracker", () => {
	describe("seed / recordCall / tracking", () => {
		it("tracks a seeded tool", () => {
			const tracker = new WeightedLruTracker();
			tracker.seed("tasks_create", 100);
			expect(tracker.isTracked("tasks_create")).toBe(true);
			expect(tracker.trackedNames()).toEqual(["tasks_create"]);
			expect(tracker.weightOf("tasks_create")).toBe(100);
		});

		it("recordCall is a no-op for a name the tracker never seeded", () => {
			const tracker = new WeightedLruTracker();
			tracker.recordCall("tools_list");
			expect(tracker.isTracked("tools_list")).toBe(false);
			expect(tracker.trackedNames()).toEqual([]);
		});

		it("re-seeding an already-tracked tool updates its weight and refreshes its priority", () => {
			const tracker = new WeightedLruTracker();
			tracker.seed("tasks_depend", 100);
			tracker.seed("tasks_depend", 200);
			expect(tracker.weightOf("tasks_depend")).toBe(200);
		});

		it("totalWeightTokens sums every tracked entry's own weight", () => {
			const tracker = new WeightedLruTracker();
			tracker.seed("a", 100);
			tracker.seed("b", 250);
			expect(tracker.totalWeightTokens()).toBe(350);
		});
	});

	describe("priority damping proportional to weight", () => {
		it("a heavier tool earns a smaller priority bump per call than a lighter one, under equal usage", () => {
			const heavy = new WeightedLruTracker();
			const light = new WeightedLruTracker();
			heavy.seed("heavy", 1000);
			light.seed("light", 10);
			// Both seeded once (one bump each) -- read back via snapshot (only entry -> priority is
			// directly comparable since both start from zero).
			const heavyPriority = heavy.snapshot()[0]!.priority;
			const lightPriority = light.snapshot()[0]!.priority;
			expect(heavyPriority).toBeLessThan(lightPriority);
		});

		it("under equal usage (same call count), a heavy and a light tool started together rank the heavy one lower", () => {
			const tracker = new WeightedLruTracker();
			tracker.seed("heavy", 1000);
			tracker.seed("light", 10);
			// clear the "just seeded" protection so a real evict-order comparison is meaningful
			tracker.evictToBudget(Number.POSITIVE_INFINITY);
			tracker.recordCall("heavy");
			tracker.recordCall("light");
			const snapshot = tracker.snapshot();
			expect(snapshot[0]!.toolName).toBe("heavy"); // lowest priority first == evicted first
			expect(snapshot[1]!.toolName).toBe("light");
		});
	});

	describe("evictToBudget", () => {
		it("evicts nothing when total weight is already at or under budget", () => {
			const tracker = new WeightedLruTracker();
			tracker.seed("a", 100);
			tracker.evictToBudget(1000); // way under budget
			const result = tracker.evictToBudget(100); // exactly at budget, after the turn boundary above
			expect(result.evicted).toEqual([]);
			expect(tracker.isTracked("a")).toBe(true);
		});

		it("evicts the lowest-priority entries first until under budget", () => {
			const tracker = new WeightedLruTracker();
			tracker.seed("a", 100);
			tracker.seed("b", 100);
			tracker.seed("c", 100);
			// End the "just seeded" turn so all three are evictable, then make "c" the most recently
			// used so it's protected by real recency, not just seed-time luck.
			tracker.evictToBudget(Number.POSITIVE_INFINITY);
			tracker.recordCall("c");
			const result = tracker.evictToBudget(100); // room for exactly one entry's worth of weight
			expect(result.evicted.length).toBe(2);
			expect(result.evicted).not.toContain("c");
			expect(tracker.isTracked("c")).toBe(true);
			expect(tracker.totalWeightTokens()).toBeLessThanOrEqual(100);
		});

		it("never evicts an entry called/seeded during the current turn, even over budget", () => {
			const tracker = new WeightedLruTracker();
			tracker.seed("a", 500);
			const result = tracker.evictToBudget(0); // impossible budget
			expect(result.evicted).toEqual([]);
			expect(tracker.isTracked("a")).toBe(true);
		});

		it("clears the turn's call markers, so a second evictToBudget call can evict what survived only by protection", () => {
			const tracker = new WeightedLruTracker();
			tracker.seed("a", 500);
			tracker.evictToBudget(0); // protected this turn, survives despite the impossible budget
			expect(tracker.isTracked("a")).toBe(true);
			const result = tracker.evictToBudget(0); // new turn -- no longer protected
			expect(result.evicted).toEqual(["a"]);
			expect(tracker.isTracked("a")).toBe(false);
		});

		it("behavior exactly at budget evicts nothing", () => {
			const tracker = new WeightedLruTracker();
			tracker.seed("a", 100);
			tracker.evictToBudget(Number.POSITIVE_INFINITY); // clear protection
			const result = tracker.evictToBudget(100); // total (100) is not > budget (100)
			expect(result.evicted).toEqual([]);
		});

		it("behavior under budget (plenty of room) evicts nothing", () => {
			const tracker = new WeightedLruTracker();
			tracker.seed("a", 50);
			tracker.evictToBudget(Number.POSITIVE_INFINITY);
			const result = tracker.evictToBudget(1000);
			expect(result.evicted).toEqual([]);
		});

		it("behavior over budget with everything protected evicts nothing but leaves total over budget", () => {
			const tracker = new WeightedLruTracker();
			tracker.seed("a", 500);
			tracker.seed("b", 500);
			const result = tracker.evictToBudget(100);
			expect(result.evicted).toEqual([]);
			expect(tracker.totalWeightTokens()).toBe(1000);
		});
	});

	describe("snapshot", () => {
		it("orders entries ascending by priority (most-evictable first)", () => {
			const tracker = new WeightedLruTracker();
			tracker.seed("first", 100);
			tracker.evictToBudget(Number.POSITIVE_INFINITY);
			tracker.seed("second", 100); // seeded later -> higher priority (more total credit)
			const names = tracker.snapshot().map((entry) => entry.toolName);
			expect(names).toEqual(["first", "second"]);
		});

		it("is read-only -- never mutates tracked state", () => {
			const tracker = new WeightedLruTracker();
			tracker.seed("a", 100);
			tracker.snapshot();
			tracker.snapshot();
			expect(tracker.trackedNames()).toEqual(["a"]);
		});
	});
});
