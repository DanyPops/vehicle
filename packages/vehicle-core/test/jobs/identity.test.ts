import { describe, expect, it } from "bun:test";
import { vehicleJobIdentityMatches } from "../../src/jobs/identity.ts";

describe("vehicleJobIdentityMatches", () => {
	it("matches only an identical instance token", () => {
		expect(vehicleJobIdentityMatches("token-a", "token-a")).toBe(true);
		expect(vehicleJobIdentityMatches("token-a", "token-b")).toBe(false);
	});
});
