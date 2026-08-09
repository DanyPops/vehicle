import { describe, expect, it } from "bun:test";
import {
	DEFAULT_PRESENTATION_MAX_BYTES,
	GENERIC_PRESENTATION_MAX_COLUMNS,
	GENERIC_PRESENTATION_MAX_ROWS,
	parseGenericVehiclePresentation,
	projectGenericVehiclePresentation,
	projectGenericVehicleProgress,
} from "../src/vehicle-render-model.ts";

const variants: unknown[] = [
	[],
	Array.from({ length: 80 }, (_, index) => ({ id: index, title: `row-${index}`, token: "RAW_SECRET" })),
	["one", "two"],
	{ id: "a", active: true, token: "RAW_SECRET" },
	{ content: [{ type: "text", text: "Narrative" }], total: 1 },
	{ nested: { value: true } },
];

describe("vehicle.tool-details/v1", () => {
	it("round-trips every generic DTO variant through the strict replay parser", () => {
		for (const output of variants) {
			const projected = projectGenericVehiclePresentation(output);
			expect(parseGenericVehiclePresentation(projected)).toEqual(projected);
			expect(JSON.stringify(projected)).not.toContain("RAW_SECRET");
			expect(Buffer.byteLength(JSON.stringify(projected))).toBeLessThanOrEqual(DEFAULT_PRESENTATION_MAX_BYTES);
		}
		const progress = projectGenericVehicleProgress({ current: 4, total: 10 });
		expect(parseGenericVehiclePresentation(progress)).toEqual(progress);
	});

	it("persists independent row/column/field/preview bounds and completeness metadata", () => {
		const output = Array.from({ length: 100 }, (_, row) =>
			Object.fromEntries(Array.from({ length: 20 }, (_, column) => [`column${column}`, `${row}:${column}:${"x".repeat(500)}`])),
		);
		const projected = projectGenericVehiclePresentation(output);
		expect(projected.view.kind).toBe("table");
		if (projected.view.kind !== "table") return;
		expect(projected.view.rows.length).toBeLessThanOrEqual(GENERIC_PRESENTATION_MAX_ROWS);
		expect(projected.view.columns.length).toBe(GENERIC_PRESENTATION_MAX_COLUMNS);
		expect(projected.view.columnsOmitted).toBe(12);
		expect(projected.view.completeness.total).toBe(100);
		expect(projected.view.completeness.omitted).toBeGreaterThan(0);
		expect(Buffer.byteLength(JSON.stringify(projected))).toBeLessThanOrEqual(DEFAULT_PRESENTATION_MAX_BYTES);
	});

	it("rejects malformed, cyclic, unknown-version, and oversized replay details", () => {
		const valid = projectGenericVehiclePresentation(["one"]);
		expect(parseGenericVehiclePresentation({ ...valid, extra: true })).toBeUndefined();
		expect(parseGenericVehiclePresentation({ ...valid, schema: "vehicle.tool-details/v2" })).toBeUndefined();
		const cyclic: { self?: unknown } = {};
		cyclic.self = cyclic;
		expect(parseGenericVehiclePresentation(cyclic)).toBeUndefined();
		expect(parseGenericVehiclePresentation({ ...valid, padding: "x".repeat(DEFAULT_PRESENTATION_MAX_BYTES) })).toBeUndefined();
	});
});
