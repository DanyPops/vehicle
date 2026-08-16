import { describe, expect, it } from "bun:test";
import { estimateToolWeightTokens, type ToolWeightInput } from "../src/vehicle-shell/tool-weight.ts";

function tool(overrides: Partial<ToolWeightInput> = {}): ToolWeightInput {
	return {
		name: "tasks_depend",
		description: "Adds a dependency edge between two tasks.",
		parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
		...overrides,
	};
}

describe("estimateToolWeightTokens", () => {
	it("sums name + description + serialized-parameters length, divided by 4 and rounded up", () => {
		const input = tool();
		const expectedChars = input.name.length + input.description.length + JSON.stringify(input.parameters).length;
		expect(estimateToolWeightTokens(input)).toBe(Math.ceil(expectedChars / 4));
	});

	it("a small schema produces a small weight", () => {
		const weight = estimateToolWeightTokens(tool({ parameters: { type: "object", properties: {} } }));
		expect(weight).toBeGreaterThan(0);
		expect(weight).toBeLessThan(50);
	});

	it("a large, deeply-nested schema produces a proportionally larger weight than a small one", () => {
		const smallWeight = estimateToolWeightTokens(tool({ parameters: { type: "object", properties: {} } }));
		const largeSchema = {
			type: "object",
			properties: Object.fromEntries(
				Array.from({ length: 30 }, (_, index) => [
					`field${index}`,
					{ type: "object", properties: { nested: { type: "string", description: "a reasonably long description of a nested field" } } },
				]),
			),
		};
		const largeWeight = estimateToolWeightTokens(tool({ parameters: largeSchema }));
		expect(largeWeight).toBeGreaterThan(smallWeight * 10);
	});

	it("an empty description still contributes only its own (zero) length, never throwing", () => {
		const weight = estimateToolWeightTokens(tool({ description: "" }));
		expect(weight).toBeGreaterThan(0); // name + parameters still contribute
	});

	it("a tool with no declared parameters (an empty object schema) is never zero-weighted", () => {
		const weight = estimateToolWeightTokens(tool({ name: "x", description: "", parameters: {} }));
		expect(weight).toBeGreaterThan(0);
	});

	it("is a pure function -- calling it twice on equal input returns the same result", () => {
		const input = tool();
		expect(estimateToolWeightTokens(input)).toBe(estimateToolWeightTokens(tool()));
	});
});
