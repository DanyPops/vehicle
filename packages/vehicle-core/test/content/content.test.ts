import { describe, expect, it } from "bun:test";
import { extractVehicleContent } from "../../src/content/content.ts";

describe("extractVehicleContent", () => {
	it("returns the content blocks when every element is a well-formed text block", () => {
		const output = { runId: "run-1", content: [{ type: "text", text: "Created run run-1." }] };
		expect(extractVehicleContent(output)).toEqual([{ type: "text", text: "Created run run-1." }]);
	});

	it("returns undefined when output has no content field", () => {
		expect(extractVehicleContent({ runId: "run-1" })).toBeUndefined();
	});

	it("returns undefined for a non-object, null, or array output", () => {
		expect(extractVehicleContent("a string")).toBeUndefined();
		expect(extractVehicleContent(null)).toBeUndefined();
		expect(extractVehicleContent([1, 2, 3])).toBeUndefined();
	});

	it("returns undefined when content is present but empty", () => {
		expect(extractVehicleContent({ content: [] })).toBeUndefined();
	});

	it("returns undefined when content is not an array", () => {
		expect(extractVehicleContent({ content: "not an array" })).toBeUndefined();
	});

	it("returns undefined when any block has an unsupported type or a non-string text", () => {
		expect(extractVehicleContent({ content: [{ type: "image", text: "x" }] })).toBeUndefined();
		expect(extractVehicleContent({ content: [{ type: "text", text: 42 }] })).toBeUndefined();
	});

	it("returns undefined when any block in the array is malformed, rather than the well-formed prefix", () => {
		const output = { content: [{ type: "text", text: "ok" }, "not a block"] };
		expect(extractVehicleContent(output)).toBeUndefined();
	});
});
