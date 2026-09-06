import { createHash } from "node:crypto";
import type { VehicleManifestOperation } from "@danypops/vehicle-core";
import { Type } from "typebox";

export const shellNamesSchema = Type.Object({
	names: Type.Array(Type.String({ minLength: 1, maxLength: 256 }), { minItems: 1, maxItems: 16 }),
});

const errors = {
	"invalid-input": "Invalid shell input; check the declared limits and cursor format.",
	"stale-cursor": "Catalog or filters changed; restart discovery without cursor.",
	"entry-too-large": "An operation identity exceeds the page budget; increase maxBytes.",
	"output-budget-exceeded": "Status output exceeds 64 KiB; request fewer exact names.",
};

/** Returns a bounded diagnostic with a stable machine code. */
export function shellInputError(code: keyof typeof errors = "invalid-input") {
	return { isError: true, content: [{ type: "text" as const, text: errors[code] }], details: { code } };
}

/** Keeps both ends of a long string so terminal activation status remains visible. */
export function boundShellText(text: string, maxChars: number): string {
	if (text.length <= maxChars) return text;
	const half = Math.floor((maxChars - 24) / 2);
	return `${text.slice(0, half)}\n[summary truncated]\n${text.slice(-half)}`;
}

type ListBounds = { limit: number; maxBytes: number; cursor?: string; filterKey: string };

/** Pages the current ranked catalog, rejecting cursors from a different catalog or filter. */
export function pageShellOperations(
	operations: readonly VehicleManifestOperation[],
	bounds: ListBounds,
	format: (op: VehicleManifestOperation) => string,
) {
	const fingerprint = createHash("sha256").update(bounds.filterKey);
	for (const operation of operations) fingerprint.update(JSON.stringify(operation));
	const hash = fingerprint.digest("hex");
	let offset = 0;
	if (bounds.cursor) {
		const match = /^(\d{1,9}):([a-f0-9]{64})$/.exec(bounds.cursor);
		if (!match) return shellInputError();
		if (match[2] !== hash) return shellInputError("stale-cursor");
		offset = Number(match[1]);
		if (offset >= operations.length) return shellInputError();
	}
	const rows: { name: string; description: string; summaryTruncated?: boolean }[] = [];
	const lines: string[] = [];
	const result = () => {
		const nextOffset = offset + rows.length;
		const nextCursor = nextOffset < operations.length ? `${nextOffset}:${hash}` : undefined;
		const truncated = nextCursor !== undefined || rows.some((row) => row.summaryTruncated);
		return {
			content: [{ type: "text" as const, text: lines.join("\n") + (nextCursor ? `\n[more operations; cursor=${nextCursor}]` : "") }],
			details: { operations: rows, total: operations.length, returned: rows.length, truncated, nextCursor },
		};
	};
	for (const op of operations.slice(offset, offset + bounds.limit)) {
		const normalized = op.description.replaceAll(/\s+/g, " ");
		const description =
			normalized.length <= 160 ? normalized : `${normalized.slice(0, 138).replace(/[\uD800-\uDBFF]$/, "")} [summary truncated]`;
		const formatted = format({ ...op, description });
		const text = boundShellText(formatted, 2_048);
		const shortened = normalized.length > 160 || text !== formatted;
		rows.push({ name: op.name, description, ...(shortened ? { summaryTruncated: true } : {}) });
		lines.push(text);
		if (Buffer.byteLength(JSON.stringify(result())) > bounds.maxBytes && rows.length === 1) {
			rows[0] = { name: op.name, description: "", summaryTruncated: true };
			lines[0] = `${op.name} -- [summary truncated]`;
		}
		if (Buffer.byteLength(JSON.stringify(result())) > bounds.maxBytes) {
			rows.pop();
			lines.pop();
			if (rows.length === 0) return shellInputError("entry-too-large");
			break;
		}
	}
	return result();
}
