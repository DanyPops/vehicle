/**
 * A block of narrative text meant to be read by the model, not parsed as
 * data -- same field name and shape MCP's own CallToolResult.content and
 * Pi's own ToolDefinition.execute() return already use, so a Vehicle
 * operation adopting this needs no translation layer at either boundary.
 * Only the "text" variant exists here; there's no Vehicle use case yet for
 * MCP's image/audio/resource-link block kinds.
 */
export interface VehicleContentBlock {
	readonly type: "text";
	readonly text: string;
}

/**
 * An operation's Output type can intersect this to carry its own
 * model-facing narrative alongside its structured data, e.g.
 * `type RunOutput = { runId: string; created: Task[] } & WithVehicleContent`.
 * The operation itself builds `content` since it's the only code that
 * actually knows how to describe what it computed -- never a per-consumer
 * override bolted on wherever the operation happens to get registered.
 */
export interface WithVehicleContent {
	readonly content?: readonly VehicleContentBlock[];
}

/**
 * Reads an operation's own `content` blocks off its output when present and
 * well-formed, so a generic Vehicle client can prefer them over dumping raw
 * JSON at the model -- without knowing anything about the operation's own
 * domain shape. Returns undefined for a malformed or absent `content` field;
 * the caller falls back to its own default (formatted JSON) rather than
 * risk forwarding partial/garbled blocks.
 */
export function extractVehicleContent(output: unknown): readonly VehicleContentBlock[] | undefined {
	if (typeof output !== "object" || output === null || Array.isArray(output)) return undefined;
	const content = (output as { readonly content?: unknown }).content;
	if (!Array.isArray(content) || content.length === 0) return undefined;
	const blocks: VehicleContentBlock[] = [];
	for (const block of content) {
		if (typeof block !== "object" || block === null) return undefined;
		const { type, text } = block as { readonly type?: unknown; readonly text?: unknown };
		if (type !== "text" || typeof text !== "string") return undefined;
		blocks.push({ type: "text", text });
	}
	return blocks;
}
