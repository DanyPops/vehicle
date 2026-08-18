import { describe, expect, it } from "bun:test";
import { evaluateDeclaredValueCoverage, type ToolShellDeclaredValueCase, type ToolShellRenderOptions } from "../src/vehicle-conformance.ts";

/**
 * Regression coverage for evaluateDeclaredValueCoverage's own classifier -- decoupled from
 * runToolShellDualChannelConformance's bun:test wiring so the exact pi-web-spider bug shape
 * (7 of 8 WebFormat values falling through to a raw JSON.stringify dump, only "markdown"
 * rendered) can be asserted against directly. Proves the check would have caught that bug,
 * not merely that a well-behaved fixture happens to pass it (see tool-shell-dual-channel.test.ts).
 */

const WEB_SPIDER_FORMATS = ["markdown", "search", "lean", "links", "highlights", "tree", "source", "meta"] as const;

function webSpiderPayloadFor(format: string): unknown {
	if (format === "markdown") return { markdown: "# Fetched page\n\nBody." };
	return { format, results: [{ title: "Example", url: "https://example.com" }] };
}

/** Reproduces pi-web-spider's actual pre-fix primaryLines(): exactly one format renders for
 * real, every other format falls through to JSON.stringify(payload, null, 2) verbatim. */
function webSpiderBuggyRender(_value: string, rawPayload: unknown, options: ToolShellRenderOptions): readonly string[] {
	const payload = rawPayload as { markdown?: string };
	if (typeof payload.markdown === "string") {
		return [`# ${payload.markdown.split("\n")[0]?.replace(/^#\s*/, "")}`.slice(0, options.width)];
	}
	return JSON.stringify(rawPayload, null, 2).split("\n");
}

/** The fixed shape: every format gets a real, differentiated branch instead of a shared fallback. */
function webSpiderFixedRender(value: string, rawPayload: unknown, options: ToolShellRenderOptions): readonly string[] {
	const payload = rawPayload as { markdown?: string; results?: Array<{ title: string; url: string }> };
	if (typeof payload.markdown === "string") {
		return [`# ${payload.markdown.split("\n")[0]?.replace(/^#\s*/, "")}`.slice(0, options.width)];
	}
	const results = payload.results ?? [];
	return [`${value}: ${results.length} result(s)`.slice(0, options.width), ...results.map((r) => `  ${r.title} (${r.url})`.slice(0, options.width))];
}

const cases: ToolShellDeclaredValueCase[] = WEB_SPIDER_FORMATS.map((value) => ({ value, rawPayload: webSpiderPayloadFor(value) }));

describe("evaluateDeclaredValueCoverage", () => {
	it("flags the real pi-web-spider bug shape: only 1 of 8 declared formats escapes a raw JSON dump", () => {
		const { nonRawValues, rawValues } = evaluateDeclaredValueCoverage(cases, webSpiderBuggyRender);
		expect(nonRawValues).toEqual(["markdown"]);
		expect(rawValues).toEqual(["search", "lean", "links", "highlights", "tree", "source", "meta"]);
		// This is what the wrapping it() in runToolShellDualChannelConformance would assert on --
		// spelled out here so a change to that threshold is caught by this test too.
		expect(nonRawValues.length).toBeLessThan(Math.min(2, cases.length));
	});

	it("passes the fixed shape: every declared format renders its own real, non-raw view", () => {
		const { nonRawValues, rawValues } = evaluateDeclaredValueCoverage(cases, webSpiderFixedRender);
		expect(rawValues).toEqual([]);
		expect(nonRawValues).toEqual([...WEB_SPIDER_FORMATS]);
		expect(nonRawValues.length).toBeGreaterThanOrEqual(Math.min(2, cases.length));
	});

	it("is whitespace/ANSI-insensitive -- a reflowed or styled copy of the same JSON is still classified as raw", () => {
		const rawPayload = { a: 1, b: [1, 2, 3] };
		const rendered = (_value: string, payload: unknown) => {
			const json = JSON.stringify(payload, null, 2);
			// Re-wrap at a different width and add an ANSI SGR pair -- still the same JSON content.
			return [`\u001b[2m${json.replace(/\n/g, " ")}\u001b[0m`];
		};
		const { nonRawValues, rawValues } = evaluateDeclaredValueCoverage([{ value: "x", rawPayload }], rendered);
		expect(rawValues).toEqual(["x"]);
		expect(nonRawValues).toEqual([]);
	});
});
