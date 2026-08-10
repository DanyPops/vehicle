import { describe, expect, it } from "bun:test";
import { initTheme } from "@earendil-works/pi-coding-agent";
import { expandHint, shouldShowExpandHint } from "../src/expand-hint.ts";

// keyHint() reads Pi's global theme singleton -- throws "Theme not initialized" without this,
// same requirement vehicle-render.test.ts's own moreRowsLine coverage already documents.
initTheme();

describe("expand-hint: single source of truth for every Vehicle Pi card's expand affordance", () => {
	it("formats the real, possibly user-remapped app.tools.expand keybinding with a default description", () => {
		expect(expandHint()).toContain("expand for details");
	});

	it("accepts a call-site-specific description while keeping the keybinding id centralized", () => {
		expect(expandHint("to expand")).toContain("to expand");
		expect(expandHint("to expand")).not.toContain("expand for details");
	});

	it("shows the hint only while collapsed and only when something is genuinely hidden", () => {
		expect(shouldShowExpandHint(false, true)).toBe(true);
		expect(shouldShowExpandHint(true, true)).toBe(false);
		expect(shouldShowExpandHint(false, false)).toBe(false);
		expect(shouldShowExpandHint(true, false)).toBe(false);
	});
});
