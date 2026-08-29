import { describe, expect, it } from "bun:test";
import {
	DEFAULT_VEHICLE_PROTOCOL_SUPPORT,
	isVehicleProtocolAgreement,
	MAX_VEHICLE_PROTOCOL_CAPABILITIES,
	negotiateVehicleProtocol,
} from "../../src/protocol/negotiation.js";

const server = {
	minimumVersion: 1,
	maximumVersion: 3,
	capabilities: ["progress", "events", "jobs"],
} as const;

describe("negotiateVehicleProtocol", () => {
	it("selects the highest shared version and recognized capabilities", () => {
		expect(
			negotiateVehicleProtocol(server, {
				minimumVersion: 2,
				maximumVersion: 4,
				requiredCapabilities: ["events"],
				optionalCapabilities: ["jobs", "future"],
			}),
		).toEqual({ ok: true, value: { version: 3, capabilities: ["events", "jobs"] } });
	});

	it("returns a typed incompatibility when version ranges do not overlap", () => {
		expect(
			negotiateVehicleProtocol(server, {
				minimumVersion: 4,
				maximumVersion: 5,
				requiredCapabilities: [],
				optionalCapabilities: [],
			}),
		).toMatchObject({ ok: false, code: "protocol-version-incompatible" });
	});

	it("fails for an unsupported required capability and ignores an unknown optional one", () => {
		expect(
			negotiateVehicleProtocol(server, {
				minimumVersion: 1,
				maximumVersion: 1,
				requiredCapabilities: ["unknown"],
				optionalCapabilities: [],
			}),
		).toEqual({ ok: false, code: "protocol-capability-unsupported", message: 'Vehicle protocol requires unsupported capability "unknown"' });
		expect(
			negotiateVehicleProtocol(server, {
				minimumVersion: 1,
				maximumVersion: 1,
				requiredCapabilities: [],
				optionalCapabilities: ["unknown"],
			}),
		).toEqual({ ok: true, value: { version: 1, capabilities: [] } });
	});

	it("rejects malformed or unbounded offers before negotiation", () => {
		expect(
			negotiateVehicleProtocol(server, {
				minimumVersion: 3,
				maximumVersion: 2,
				requiredCapabilities: [],
				optionalCapabilities: [],
			}),
		).toMatchObject({ ok: false, code: "protocol-offer-invalid" });
		expect(
			negotiateVehicleProtocol(server, {
				minimumVersion: 1,
				maximumVersion: 1,
				requiredCapabilities: [],
				optionalCapabilities: Array.from({ length: MAX_VEHICLE_PROTOCOL_CAPABILITIES + 1 }, (_, index) => `cap-${index}`),
			}),
		).toMatchObject({ ok: false, code: "protocol-offer-invalid" });
	});

	it("validates a wire agreement instead of trusting an assertion", () => {
		expect(isVehicleProtocolAgreement({ version: 1, capabilities: ["events"] })).toBe(true);
		expect(isVehicleProtocolAgreement({ version: 0, capabilities: [] })).toBe(false);
		expect(isVehicleProtocolAgreement({ version: 1, capabilities: [""] })).toBe(false);
		expect(isVehicleProtocolAgreement({ version: 1, capabilities: "events" })).toBe(false);
	});

	it("provides a bounded version-one compatibility default", () => {
		expect(DEFAULT_VEHICLE_PROTOCOL_SUPPORT).toEqual({ minimumVersion: 1, maximumVersion: 1, capabilities: [] });
	});
});
