import { runToolShellDualChannelConformance, type ToolShellDualChannelFixture } from "../src/vehicle-conformance.ts";

const fixture: ToolShellDualChannelFixture = {
	label: "synthetic provider",
	async create() {
		const subject = {
			bounds: { modelContentBytes: 256, presentationDetailsBytes: 512 },
			execute: async () => ({
				content: "MODEL_ONLY: semantic result",
				details: {
					vehicle: { name: "synthetic", version: "1.0.0", operation: "synthetic.read", operationVersion: 1 },
					presentation: { schema: "vehicle.tool-details/v1", view: { kind: "list", marker: "PRESENTATION_ONLY" } },
				},
			}),
			render: (_snapshot: unknown, options: { width: 40 | 80 | 120; expanded: boolean; partial?: boolean }) => {
				const rows = options.partial ? ["progress 50%"] : options.expanded ? ["PRESENTATION_ONLY", "second row"] : ["PRESENTATION_ONLY"];
				return rows.map((row) => row.slice(0, options.width));
			},
			replay: (details: unknown, fallbackContent: string, options: { width: 40 | 80 | 120 }) => {
				const valid =
					typeof details === "object" && details !== null && (details as { schema?: unknown }).schema === "vehicle.tool-details/v1";
				return [(valid ? "valid" : fallbackContent).slice(0, options.width)];
			},
			renderCall: (args: unknown, width: 40 | 80 | 120) => {
				const name = typeof args === "object" && args !== null ? String((args as { name?: unknown }).name ?? "") : "";
				return [`Synthetic Read ${name}`.slice(0, width)];
			},
			invalidProjection: () => Promise.reject(new Error("projection rejected: cyclic details")),
			// Two declared "format" values, each rendering something real rather than a raw JSON dump --
			// proves the declared-value coverage check passes for a well-behaved subject.
			declaredValueCases: [
				{ value: "markdown", rawPayload: { markdown: "# Heading\nBody text." } },
				{ value: "table", rawPayload: { rows: [{ id: "1" }, { id: "2" }] } },
			],
			renderDeclaredValue: (value: string, rawPayload: unknown, options: { width: 40 | 80 | 120 }) => {
				if (value === "markdown") {
					const markdown = (rawPayload as { markdown: string }).markdown;
					return [`Markdown: ${markdown.split("\n")[0]}`.slice(0, options.width)];
				}
				const rows = (rawPayload as { rows: unknown[] }).rows;
				return [`${rows.length} row(s)`.slice(0, options.width)];
			},
		};
		return { subject, cleanup: () => Promise.resolve() };
	},
};

runToolShellDualChannelConformance(fixture);
