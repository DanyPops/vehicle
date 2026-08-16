import { describe, expect, it } from "bun:test";
import { computeToolContextBudget, type ContextBudgetOptions } from "../src/vehicle-shell/context-budget.ts";

const options: ContextBudgetOptions = { minToolBudgetTokens: 1_000, maxToolBudgetTokens: 20_000, fractionOfRemaining: 0.2 };

describe("computeToolContextBudget", () => {
	it("scales up when more room remains", () => {
		const roomy = computeToolContextBudget({ tokens: 10_000, contextWindow: 100_000 }, options, 5_000);
		const tighter = computeToolContextBudget({ tokens: 80_000, contextWindow: 100_000 }, options, 5_000);
		expect(roomy).toBeGreaterThan(tighter);
	});

	it("computes exactly fractionOfRemaining * (contextWindow - tokens) when within bounds", () => {
		const budget = computeToolContextBudget({ tokens: 10_000, contextWindow: 100_000 }, options, 5_000);
		expect(budget).toBe((100_000 - 10_000) * 0.2);
	});

	it("clamps to the minimum when remaining room is small", () => {
		const budget = computeToolContextBudget({ tokens: 99_000, contextWindow: 100_000 }, options, 5_000);
		expect(budget).toBe(options.minToolBudgetTokens);
	});

	it("clamps to the maximum when remaining room is huge", () => {
		const budget = computeToolContextBudget({ tokens: 0, contextWindow: 1_000_000 }, options, 5_000);
		expect(budget).toBe(options.maxToolBudgetTokens);
	});

	it("never goes negative even if tokens somehow exceeds contextWindow", () => {
		const budget = computeToolContextBudget({ tokens: 150_000, contextWindow: 100_000 }, options, 5_000);
		expect(budget).toBe(options.minToolBudgetTokens);
	});

	it("falls back to the given fallback (clamped) when usage is undefined", () => {
		expect(computeToolContextBudget(undefined, options, 5_000)).toBe(5_000);
	});

	it("falls back to the given fallback (clamped) when tokens is null (e.g. right after compaction)", () => {
		expect(computeToolContextBudget({ tokens: null, contextWindow: 100_000 }, options, 5_000)).toBe(5_000);
	});

	it("clamps an out-of-range fallback exactly like a real computed value", () => {
		expect(computeToolContextBudget(undefined, options, 999_999)).toBe(options.maxToolBudgetTokens);
		expect(computeToolContextBudget(undefined, options, 1)).toBe(options.minToolBudgetTokens);
	});

	it("is a pure function -- never mutates its inputs, same input always yields the same output", () => {
		const usage = { tokens: 25_000, contextWindow: 100_000 };
		const first = computeToolContextBudget(usage, options, 5_000);
		const second = computeToolContextBudget(usage, options, 5_000);
		expect(first).toBe(second);
		expect(usage).toEqual({ tokens: 25_000, contextWindow: 100_000 });
	});
});
