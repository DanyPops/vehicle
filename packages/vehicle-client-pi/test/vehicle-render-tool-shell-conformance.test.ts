/**
 * Proves vehicle-client-pi's own generic default renderer -- the one tickets/pipes and any
 * future Shell-only consumer inherit "for free" via registerVehicleTools() with no custom
 * presentations() -- is actually conformant to the Tool Shell dual-channel contract, not merely
 * assumed to be (doc 4e9e08c1, Finding 3). Wires the real renderVehicleResult/renderVehicleCall/
 * projectGenericVehiclePresentation/parseGenericVehiclePresentation through
 * runToolShellDualChannelConformance's shared fixture contract, unlike
 * vehicle-conformance's own tool-shell-dual-channel.test.ts, which only proves the harness
 * against a hand-built synthetic fixture.
 */
import type { VehicleOperationDescriptor } from "@danypops/vehicle-core";
import { runToolShellDualChannelConformance, type ToolShellDualChannelFixture } from "@danypops/vehicle-conformance";
import { initTheme, Theme, type ThemeColor } from "@earendil-works/pi-coding-agent";
import { renderVehicleCall, renderVehicleResult } from "../src/vehicle-render.ts";
import {
	DEFAULT_PRESENTATION_MAX_BYTES,
	projectGenericVehiclePresentation,
	projectGenericVehicleProgress,
} from "../src/vehicle-render-model.ts";

// A REAL Theme emitting real ANSI SGR escapes (not a bracket-marker fake like "<color>text") --
// required here because the conformance suite's own physical-line-width assertion strips real
// ANSI via a CSI regex before counting visible width (see ANSI_CSI_PATTERN in
// vehicle-conformance.ts). A bracket-marker fake theme's literal "<color>" text isn't recognized
// as invisible styling, so malevich's own truncateToWidth/measure would see (and truncate to) a
// much shorter budget than the real terminal ever would -- exactly the "ANSI-blind width
// miscalculation" vehicle-render.test.ts's own realTheme comment already documents.
const REAL_FG_COLORS: Record<ThemeColor, string> = {
	accent: "#ee0000",
	border: "#4d4d4d",
	borderAccent: "#ee0000",
	borderMuted: "#383838",
	success: "#6c9b4b",
	error: "#bd6e51",
	warning: "#dca614",
	muted: "#8f8f8f",
	dim: "#757575",
	text: "#e0e0e0",
	thinkingText: "#8f8f8f",
	userMessageText: "#e0e0e0",
	customMessageText: "#e0e0e0",
	customMessageLabel: "#876fd4",
	toolTitle: "#d39292",
	toolOutput: "#e0e0e0",
	mdHeading: "#e0e0e0",
	mdLink: "#0066cc",
	mdLinkUrl: "#0066cc",
	mdCode: "#e0e0e0",
	mdCodeBlock: "#e0e0e0",
	mdCodeBlockBorder: "#383838",
	mdQuote: "#8f8f8f",
	mdQuoteBorder: "#383838",
	mdHr: "#383838",
	mdListBullet: "#e0e0e0",
	toolDiffAdded: "#6c9b4b",
	toolDiffRemoved: "#bd6e51",
	toolDiffContext: "#8f8f8f",
	syntaxComment: "#8f8f8f",
	syntaxKeyword: "#876fd4",
	syntaxFunction: "#63bdbd",
	syntaxVariable: "#e0e0e0",
	syntaxString: "#6c9b4b",
	syntaxNumber: "#dca614",
	syntaxType: "#63bdbd",
	syntaxOperator: "#e0e0e0",
	syntaxPunctuation: "#e0e0e0",
	thinkingOff: "#8f8f8f",
	thinkingMinimal: "#8f8f8f",
	thinkingLow: "#8f8f8f",
	thinkingMedium: "#8f8f8f",
	thinkingHigh: "#8f8f8f",
	thinkingXhigh: "#8f8f8f",
	thinkingMax: "#8f8f8f",
	bashMode: "#e0e0e0",
};

// ThemeBg isn't exported from the top-level barrel; inferred instead of annotated (matches
// vehicle-render.test.ts's own REAL_BG_COLORS).
const REAL_BG_COLORS = {
	selectedBg: "#292929",
	userMessageBg: "#1f1f1f",
	customMessageBg: "#1b0d33",
	toolPendingBg: "#1f1f1f",
	toolSuccessBg: "#1d2b12",
	toolErrorBg: "#4c1405",
};

const theme = new Theme(REAL_FG_COLORS, REAL_BG_COLORS, "truecolor");

// keyHint() (used by the row-truncation "more" note) reads pi's global theme singleton.
initTheme();

const descriptor: VehicleOperationDescriptor = {
	name: "conformance.tool-shell-generic",
	version: 1,
	description: "Exercises the generic default Tool Shell renderer end to end.",
	inputSchema: { type: "object" },
	outputSchema: { type: "object" },
	permissions: [],
	effect: "read",
	idempotency: { mode: "safe" },
	streaming: false,
	longRunning: false,
	limits: { defaultTimeoutMs: 1_000, maxTimeoutMs: 5_000, maxRequestBytes: 1_024, maxResponseBytes: 1_024 },
	errors: [],
};

const resultContext = { cwd: "/tmp", isError: false } as never;
const callContext = { cwd: "/tmp" } as never;

function renderResultLines(details: unknown, contentText: string, options: { width: 40 | 80 | 120; expanded: boolean; partial?: boolean }) {
	const result = { content: [{ type: "text" as const, text: contentText }], details };
	const component = renderVehicleResult(
		descriptor,
		result,
		{ isPartial: options.partial ?? false, expanded: options.expanded },
		theme,
		resultContext,
	);
	return component.render(options.width);
}

const fixture: ToolShellDualChannelFixture = {
	label: "vehicle-client-pi generic default renderer",
	async create() {
		const subject = {
			bounds: { modelContentBytes: 4_096, presentationDetailsBytes: DEFAULT_PRESENTATION_MAX_BYTES },
			execute: async () => {
				// A real application output whose only string content is "PRESENTATION_ONLY" --
				// projected once via the real projector, exactly as vehicle-shell/tools.ts does before
				// persistence. Model content is a wholly separate string the projector never touches,
				// proving the two channels stay independent through the real projection function.
				const output = { label: "PRESENTATION_ONLY row" };
				const presentation = projectGenericVehiclePresentation(output);
				return { content: "MODEL_ONLY: semantic result", details: { presentation } };
			},
			render: (snapshot: { content: string; details: unknown }, options: { width: 40 | 80 | 120; expanded: boolean; partial?: boolean }) =>
				renderResultLines(snapshot.details, snapshot.content, options),
			replay: (rawPresentation: unknown, fallbackContent: string, options: { width: 40 | 80 | 120 }) =>
				renderResultLines({ presentation: rawPresentation }, fallbackContent, { ...options, expanded: false }),
			renderCall: (args: unknown, width: 40 | 80 | 120) => renderVehicleCall(descriptor, args, theme, callContext).render(width),
			invalidProjection: async () => {
				// The real projector's own fail-loud path: a cyclic application output can never be
				// JSON-serialized, so projectGenericVehiclePresentation throws rather than silently
				// dropping data -- the production analog of a custom VehiclePresenter throwing.
				const cyclic: Record<string, unknown> = {};
				cyclic.self = cyclic;
				return projectGenericVehiclePresentation(cyclic);
			},
			// One representative raw payload per GenericVehiclePresentationView.kind (empty/table/
			// list/fields/narrative/json/progress) -- proves the real projector+renderer pipeline
			// differentiates its own declared view kinds instead of collapsing most of them into an
			// undifferentiated raw-JSON dump (the exact pi-web-spider bug class, generalized).
			declaredValueCases: [
				{ value: "empty", rawPayload: [] },
				{
					value: "table",
					rawPayload: [
						{ id: "1", title: "First" },
						{ id: "2", title: "Second" },
					],
				},
				{ value: "list", rawPayload: ["alpha", "beta", "gamma"] },
				{ value: "fields", rawPayload: { taskId: "t-1", status: "open" } },
				{ value: "narrative", rawPayload: { content: [{ type: "text", text: "Some narration." }], blocked: false } },
				{ value: "json", rawPayload: { nested: { deeply: { unstructured: true } } } },
				{ value: "progress", rawPayload: { current: 3, total: 10 } },
			],
			renderDeclaredValue: (value: string, rawPayload: unknown, options: { width: 40 | 80 | 120; expanded: boolean }) => {
				const presentation = value === "progress" ? projectGenericVehicleProgress(rawPayload) : projectGenericVehiclePresentation(rawPayload);
				return renderResultLines({ presentation }, "MODEL_ONLY", options);
			},
		};
		return { subject, cleanup: () => Promise.resolve() };
	},
};

runToolShellDualChannelConformance(fixture);
