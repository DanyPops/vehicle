import { describe, expect, it } from "bun:test";
import { grantBudgetExhausted, mergeGrantBudget } from "../../src/jobs/grant.ts";

describe("grantBudgetExhausted", () => {
	it("is false when every set dimension still has remaining room", () => {
		expect(grantBudgetExhausted({ maxTurns: 3, maxToolCalls: 10 })).toBe(false);
	});

	it("is true once any one set dimension reaches zero -- the tightest dimension governs, not the average", () => {
		expect(grantBudgetExhausted({ maxTurns: 0, maxToolCalls: 10 })).toBe(true);
		expect(grantBudgetExhausted({ maxTurns: 3, maxToolCalls: 0 })).toBe(true);
	});

	it("is true for a negative dimension too -- a caller that over-consumed shouldn't read as still-has-room", () => {
		expect(grantBudgetExhausted({ maxTurns: -1 })).toBe(true);
	});

	it("an omitted dimension imposes no ceiling of its own", () => {
		expect(grantBudgetExhausted({ maxTurns: 5 })).toBe(false);
	});

	it("an empty budget (every dimension omitted) is never exhausted -- an unbounded grant, not a zero one", () => {
		expect(grantBudgetExhausted({})).toBe(false);
	});
});

describe("mergeGrantBudget", () => {
	it("adds a top-up onto the current remaining amount, dimension by dimension", () => {
		expect(mergeGrantBudget({ maxTurns: 1, maxToolCalls: 2 }, { maxTurns: 5, maxTokens: 1_000 })).toEqual({
			maxTurns: 6,
			maxToolCalls: 2,
			maxTokens: 1_000,
		});
	});

	it("a dimension absent from the top-up is left exactly as it was", () => {
		expect(mergeGrantBudget({ maxTurns: 1 }, {})).toEqual({ maxTurns: 1 });
	});

	it("a dimension the current budget never had is introduced fresh by the top-up", () => {
		expect(mergeGrantBudget({}, { maxWallClockMs: 60_000 })).toEqual({ maxWallClockMs: 60_000 });
	});
});
