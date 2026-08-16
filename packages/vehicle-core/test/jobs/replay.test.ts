import { describe, expect, it } from "bun:test";
import { createStaticVehicleJobWakeLog } from "../../src/jobs/replay.ts";

describe("createStaticVehicleJobWakeLog", () => {
	it("replays a fixed entry list with the same since()/cursor contract as a live VehicleJobWakeLog", () => {
		const reader = createStaticVehicleJobWakeLog([
			{ seq: 1, at: 100, progress: "a" },
			{ seq: 2, at: 200, progress: "b" },
			{ seq: 3, at: 300, progress: "c" },
		]);
		expect(reader.cursor).toBe(3);
		expect(reader.since(0).map((entry) => entry.progress)).toEqual(["a", "b", "c"]);
		expect(reader.since(1).map((entry) => entry.progress)).toEqual(["b", "c"]);
		expect(reader.since(3)).toEqual([]);
	});

	it("sorts out-of-order input by seq before computing cursor", () => {
		const reader = createStaticVehicleJobWakeLog([
			{ seq: 2, at: 200, progress: "b" },
			{ seq: 1, at: 100, progress: "a" },
		]);
		expect(reader.cursor).toBe(2);
		expect(reader.since(0).map((entry) => entry.progress)).toEqual(["a", "b"]);
	});

	it("an empty entry list has cursor 0", () => {
		expect(createStaticVehicleJobWakeLog([]).cursor).toBe(0);
	});
});
