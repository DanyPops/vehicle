import { describe, expect, it } from "bun:test";
import {
	initialFireAt,
	isValidVehicleScheduleTrigger,
	nextFireAtAfterFire,
	nextFireAtAfterRestore,
	VehicleScheduleInvalidTriggerError,
	VehicleScheduleLimitExceeded,
} from "../../src/schedules/schedule.ts";

describe("isValidVehicleScheduleTrigger", () => {
	it("accepts a real positive-finite 'at' or 'every' trigger", () => {
		expect(isValidVehicleScheduleTrigger({ kind: "at", at: 5_000 })).toBe(true);
		expect(isValidVehicleScheduleTrigger({ kind: "every", intervalMs: 10_000 })).toBe(true);
	});

	it("rejects a non-finite 'at' or 'intervalMs' -- NaN/Infinity would poison every arithmetic function downstream", () => {
		expect(isValidVehicleScheduleTrigger({ kind: "at", at: Number.NaN })).toBe(false);
		expect(isValidVehicleScheduleTrigger({ kind: "at", at: Number.POSITIVE_INFINITY })).toBe(false);
		expect(isValidVehicleScheduleTrigger({ kind: "every", intervalMs: Number.NaN })).toBe(false);
		expect(isValidVehicleScheduleTrigger({ kind: "every", intervalMs: Number.POSITIVE_INFINITY })).toBe(false);
	});

	it("rejects a zero or negative 'at' or 'intervalMs' -- a zero/negative interval would refire immediately forever", () => {
		expect(isValidVehicleScheduleTrigger({ kind: "at", at: 0 })).toBe(false);
		expect(isValidVehicleScheduleTrigger({ kind: "at", at: -1 })).toBe(false);
		expect(isValidVehicleScheduleTrigger({ kind: "every", intervalMs: 0 })).toBe(false);
		expect(isValidVehicleScheduleTrigger({ kind: "every", intervalMs: -1_000 })).toBe(false);
	});
});

describe("initialFireAt", () => {
	it("a one-shot 'at' trigger fires at its own declared time, independent of now", () => {
		expect(initialFireAt({ kind: "at", at: 5_000 }, 1_000)).toBe(5_000);
	});

	it("a recurring 'every' trigger's first fire is now + intervalMs", () => {
		expect(initialFireAt({ kind: "every", intervalMs: 10_000 }, 1_000)).toBe(11_000);
	});

	it("throws VehicleScheduleInvalidTriggerError for a non-finite or non-positive trigger, rather than silently computing a poisoned fire time", () => {
		expect(() => initialFireAt({ kind: "every", intervalMs: Number.NaN }, 1_000)).toThrow(VehicleScheduleInvalidTriggerError);
		expect(() => initialFireAt({ kind: "every", intervalMs: -1 }, 1_000)).toThrow(VehicleScheduleInvalidTriggerError);
		expect(() => initialFireAt({ kind: "at", at: Number.NaN }, 1_000)).toThrow(VehicleScheduleInvalidTriggerError);
	});
});

describe("nextFireAtAfterFire", () => {
	it("a one-shot 'at' trigger returns undefined -- remove the entry, never re-arm", () => {
		expect(nextFireAtAfterFire({ kind: "at", at: 5_000 }, 6_000)).toBeUndefined();
	});

	it("a recurring 'every' trigger returns now + intervalMs", () => {
		expect(nextFireAtAfterFire({ kind: "every", intervalMs: 10_000 }, 6_000)).toBe(16_000);
	});
});

describe("nextFireAtAfterRestore", () => {
	it("a one-shot 'at' trigger keeps its original persisted time even if overdue -- fires ASAP, never silently dropped", () => {
		expect(nextFireAtAfterRestore({ kind: "at", at: 500 }, 500, 10_000)).toBe(500);
	});

	it("a recurring 'every' trigger still in the future keeps its persisted next fire time", () => {
		expect(nextFireAtAfterRestore({ kind: "every", intervalMs: 10_000 }, 15_000, 10_000)).toBe(15_000);
	});

	it("a recurring 'every' trigger that fell behind resumes its cadence from now, instead of firing once per missed tick", () => {
		expect(nextFireAtAfterRestore({ kind: "every", intervalMs: 10_000 }, 1_000, 100_000)).toBe(110_000);
	});
});

describe("VehicleScheduleLimitExceeded", () => {
	it("names the owner and the bound in its message", () => {
		const error = new VehicleScheduleLimitExceeded("papyrus", 32);
		expect(error.owner).toBe("papyrus");
		expect(error.max).toBe(32);
		expect(error.message).toContain("papyrus");
		expect(error.message).toContain("32");
	});
});
