import { describe, expect, it } from "bun:test";
import { vehicleApprovalRequestedEvent, vehicleApprovalResolvedEvent } from "../../src/approvals/approval.ts";

const VALID_HASH = "a".repeat(64);

function validRequest(overrides: Record<string, unknown> = {}) {
	return {
		requestId: "req-1",
		operationName: "tasks.delete",
		operationVersion: 1,
		effect: "destructive" as const,
		requestedAt: 1_000,
		expiresAt: 2_000,
		inputHash: VALID_HASH,
		...overrides,
	};
}

describe("vehicleApprovalRequestedEvent payload validation", () => {
	it("accepts a well-formed request payload", () => {
		expect(vehicleApprovalRequestedEvent.payload.safeParse(validRequest())).toEqual({ success: true, value: validRequest() });
	});

	it("accepts a well-formed principal when present", () => {
		const withPrincipal = validRequest({ principal: { id: "user-1", claims: { role: "admin" } } });
		expect(vehicleApprovalRequestedEvent.payload.safeParse(withPrincipal)).toEqual({ success: true, value: withPrincipal });
	});

	it("rejects a bogus effect that isn't one of the real VehicleEffect discriminator values", () => {
		expect(vehicleApprovalRequestedEvent.payload.safeParse(validRequest({ effect: "banana" })).success).toBe(false);
	});

	it("rejects a non-string effect", () => {
		expect(vehicleApprovalRequestedEvent.payload.safeParse(validRequest({ effect: 42 })).success).toBe(false);
	});

	it("rejects an inputHash that isn't a real sha256 hex digest", () => {
		expect(vehicleApprovalRequestedEvent.payload.safeParse(validRequest({ inputHash: "not-a-hash" })).success).toBe(false);
		expect(vehicleApprovalRequestedEvent.payload.safeParse(validRequest({ inputHash: "A".repeat(64) })).success).toBe(false); // uppercase never produced by hashApprovalInput
		expect(vehicleApprovalRequestedEvent.payload.safeParse(validRequest({ inputHash: "a".repeat(63) })).success).toBe(false); // too short
	});

	it("rejects a malformed principal (missing id, or a non-object claims)", () => {
		expect(vehicleApprovalRequestedEvent.payload.safeParse(validRequest({ principal: { claims: {} } })).success).toBe(false);
		expect(vehicleApprovalRequestedEvent.payload.safeParse(validRequest({ principal: { id: "u", claims: "nope" } })).success).toBe(false);
		expect(vehicleApprovalRequestedEvent.payload.safeParse(validRequest({ principal: "not-an-object" })).success).toBe(false);
	});

	it("rejects non-finite or non-positive-integer numeric fields", () => {
		expect(vehicleApprovalRequestedEvent.payload.safeParse(validRequest({ requestedAt: Number.NaN })).success).toBe(false);
		expect(vehicleApprovalRequestedEvent.payload.safeParse(validRequest({ expiresAt: Number.POSITIVE_INFINITY })).success).toBe(false);
		expect(vehicleApprovalRequestedEvent.payload.safeParse(validRequest({ operationVersion: 0 })).success).toBe(false);
		expect(vehicleApprovalRequestedEvent.payload.safeParse(validRequest({ operationVersion: 1.5 })).success).toBe(false);
	});

	it("rejects a non-object payload", () => {
		expect(vehicleApprovalRequestedEvent.payload.safeParse("nope").success).toBe(false);
		expect(vehicleApprovalRequestedEvent.payload.safeParse(null).success).toBe(false);
	});

	it("rejects a payload missing a required field", () => {
		const { requestId: _requestId, ...missing } = validRequest();
		expect(vehicleApprovalRequestedEvent.payload.safeParse(missing).success).toBe(false);
	});
});

function validOutcome(overrides: Record<string, unknown> = {}) {
	return { requestId: "req-1", decision: "granted" as const, decidedAt: 1_000, ...overrides };
}

describe("vehicleApprovalResolvedEvent payload validation", () => {
	it("accepts a well-formed outcome payload, with or without optional fields", () => {
		expect(vehicleApprovalResolvedEvent.payload.safeParse(validOutcome())).toEqual({ success: true, value: validOutcome() });
		const withOptionals = validOutcome({ decidedBy: "operator-1", comment: "looks safe" });
		expect(vehicleApprovalResolvedEvent.payload.safeParse(withOptionals)).toEqual({ success: true, value: withOptionals });
	});

	it("rejects a decision outside the granted/denied discriminator", () => {
		expect(vehicleApprovalResolvedEvent.payload.safeParse(validOutcome({ decision: "maybe" })).success).toBe(false);
	});

	it("rejects a non-string decidedBy or comment when present", () => {
		expect(vehicleApprovalResolvedEvent.payload.safeParse(validOutcome({ decidedBy: 42 })).success).toBe(false);
		expect(vehicleApprovalResolvedEvent.payload.safeParse(validOutcome({ comment: { rich: "object" } })).success).toBe(false);
	});

	it("rejects a non-finite decidedAt", () => {
		expect(vehicleApprovalResolvedEvent.payload.safeParse(validOutcome({ decidedAt: Number.NaN })).success).toBe(false);
	});

	it("rejects a non-object payload", () => {
		expect(vehicleApprovalResolvedEvent.payload.safeParse("nope").success).toBe(false);
	});

	it("rejects a payload missing a required field", () => {
		const { decision: _decision, ...missing } = validOutcome();
		expect(vehicleApprovalResolvedEvent.payload.safeParse(missing).success).toBe(false);
	});
});
