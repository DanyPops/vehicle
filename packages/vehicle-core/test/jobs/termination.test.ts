import { describe, expect, it } from "bun:test";
import { resolveVehicleJobTerminationReason } from "../../src/jobs/termination.ts";

describe("resolveVehicleJobTerminationReason", () => {
	it("throws for an empty candidate list", () => {
		expect(() => resolveVehicleJobTerminationReason([])).toThrow("at least one candidate");
	});

	it("returns the sole candidate when only one is given", () => {
		expect(resolveVehicleJobTerminationReason(["succeeded"])).toBe("succeeded");
		expect(resolveVehicleJobTerminationReason(["failed"])).toBe("failed");
	});

	it("prefers canceled over every other candidate, even a completed handler racing a cancel request", () => {
		expect(resolveVehicleJobTerminationReason(["succeeded", "canceled"])).toBe("canceled");
		expect(resolveVehicleJobTerminationReason(["failed", "canceled"])).toBe("canceled");
		expect(resolveVehicleJobTerminationReason(["timeout", "canceled"])).toBe("canceled");
	});

	it("prefers timeout over failed and succeeded when no cancel was requested", () => {
		expect(resolveVehicleJobTerminationReason(["succeeded", "timeout"])).toBe("timeout");
		expect(resolveVehicleJobTerminationReason(["failed", "timeout"])).toBe("timeout");
	});

	it("prefers failed over succeeded", () => {
		expect(resolveVehicleJobTerminationReason(["succeeded", "failed"])).toBe("failed");
	});

	it("prefers orphaned over failed and succeeded, but loses to canceled and timeout", () => {
		expect(resolveVehicleJobTerminationReason(["succeeded", "orphaned"])).toBe("orphaned");
		expect(resolveVehicleJobTerminationReason(["failed", "orphaned"])).toBe("orphaned");
		expect(resolveVehicleJobTerminationReason(["orphaned", "canceled"])).toBe("canceled");
		expect(resolveVehicleJobTerminationReason(["orphaned", "timeout"])).toBe("timeout");
	});
});
