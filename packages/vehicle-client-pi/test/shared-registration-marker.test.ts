import { describe, expect, it } from "bun:test";
import { markSharedRegistration } from "../src/shared-registration-marker.ts";

describe("markSharedRegistration", () => {
	it("preserves every original field and adds shared: true", () => {
		const marked = markSharedRegistration({ description: "d", handler: () => {} });
		expect(marked.description).toBe("d");
		expect(typeof marked.handler).toBe("function");
		expect(marked.shared).toBe(true);
	});

	it("never mutates the original object", () => {
		const original = { name: "x" };
		const marked = markSharedRegistration(original);
		expect((original as { shared?: boolean }).shared).toBeUndefined();
		expect(marked.shared).toBe(true);
		expect(marked).not.toBe(original);
	});
});
