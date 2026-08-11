import { describe, expect, it } from "bun:test";
import { vehicleWidgetOwner, vehicleWidgetTitle } from "../src/vehicle-widget-header.ts";

describe("vehicleWidgetOwner", () => {
	it("capitalizes a bare manifest identity name", () => {
		expect(vehicleWidgetOwner("papyrus")).toBe("Papyrus");
		expect(vehicleWidgetOwner("pipes")).toBe("Pipes");
	});

	it("leaves an already-capitalized name unchanged", () => {
		expect(vehicleWidgetOwner("Papyrus")).toBe("Papyrus");
	});

	it("tolerates an empty name rather than throwing", () => {
		expect(vehicleWidgetOwner("")).toBe("");
	});
});

describe("vehicleWidgetTitle", () => {
	it("prefixes the widget's own label with the Vehicle's capitalized owner name", () => {
		expect(vehicleWidgetTitle("papyrus", "Notes")).toBe("Papyrus · Notes");
	});

	it("appends any further detail segments after the label, in order", () => {
		expect(vehicleWidgetTitle("papyrus", "Tasks", "pipes")).toBe("Papyrus · Tasks · pipes");
		expect(vehicleWidgetTitle("pipes", "Jobs", "1 subscribed")).toBe("Pipes · Jobs · 1 subscribed");
	});
});
