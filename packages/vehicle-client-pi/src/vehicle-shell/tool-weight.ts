/**
 * A pure, testable estimator for a Pi ToolDefinition's own context cost. Split out of
 * vehicle-shell.ts's own bundled concerns -- Phase 1 of the weighted-LRU + stretchable budget
 * design (see ttl-tracker.ts's own doc comment, which this eventually replaces).
 */

/** Matches Pi's own estimateTokens() in @earendil-works/pi-coding-agent's
 * core/compaction/compaction.ts exactly (chars/4, rounded up) -- not a made-up constant, chosen
 * deliberately so a tool's own reported weight and Pi's own context-usage accounting speak the
 * same units. */
const CHARS_PER_TOKEN = 4;

/** The subset of a Pi ToolDefinition this estimator needs -- deliberately narrower than the real
 * ToolDefinition type so this file never has to import the whole SDK shape just to accept a tool. */
export interface ToolWeightInput {
	readonly name: string;
	readonly description: string;
	/** TypeBox schema (or any JSON-Schema-shaped value) -- serialized exactly as an LLM provider
	 * would see it over the wire, so JSON.stringify is the right measure, not an ad-hoc key count. */
	readonly parameters: unknown;
}

/**
 * A tool's own context cost, in estimated tokens: `(name.length + description.length +
 * JSON.stringify(parameters).length) / 4`, rounded up. Computed once per tool -- its schema is
 * static at registration time, so this never needs to run more than once per activation, unlike
 * ctx.getContextUsage() (Phase 3), which genuinely changes turn to turn.
 *
 * No ExtensionAPI dependency -- pure function over a tool's own definition shape, same
 * testability discipline as ttl-tracker.ts.
 */
export function estimateToolWeightTokens(tool: ToolWeightInput): number {
	const chars = tool.name.length + tool.description.length + JSON.stringify(tool.parameters).length;
	return Math.ceil(chars / CHARS_PER_TOKEN);
}
