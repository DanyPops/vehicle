/**
 * Real-process regression: agent-poll-ticker.test.ts covers AgentPollTicker's dedup/framing logic
 * against a plain class; this covers the same guarantee through the real delivery seam -- a real
 * extension in a real spawned `pi --mode rpc` process, via real pi.sendMessage() -> session entries.
 */
import { describe, expect, it } from "bun:test";
import { fileURLToPath } from "node:url";
import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import { spawnRealPiProcess, waitForRpcEvent } from "@danypops/pi-process-harness";

const TICKER_FLAP_EXTENSION = fileURLToPath(new URL("./fixtures/ticker-flap-extension.ts", import.meta.url));

interface CustomMessageEntry {
	type: "custom_message";
	id: string;
	customType: string;
	content: unknown;
	display: boolean;
}

function isCustomMessageEntry(entry: unknown): entry is CustomMessageEntry {
	return typeof entry === "object" && entry !== null && (entry as { type?: unknown }).type === "custom_message";
}

describe("agent-poll-ticker: real spawned Pi process, real pi.sendMessage delivery", () => {
	it("delivers a flapped vanish event exactly once, framed as a background notification -- never as a duplicate, never as a bare user-indistinguishable message", async () => {
		// No provider/model needed: the fixture extension fires entirely from session_start, and
		// this test never sends a prompt or triggers a turn.
		const proc = spawnRealPiProcess({ extensions: [TICKER_FLAP_EXTENSION] });
		const events: AgentSessionEvent[] = [];
		proc.onEvent((event) => events.push(event));

		proc.send({ type: "get_entries" });
		const response = await waitForRpcEvent(
			events,
			(event) =>
				(event as unknown as { type: string; command?: string }).type === "response" &&
				(event as unknown as { command?: string }).command === "get_entries",
			{ timeoutMs: 10_000 },
		);
		await proc.dispose();

		const entries = (response as unknown as { data: { entries: unknown[] } }).data.entries;
		const tickerEntries = entries
			.filter(isCustomMessageEntry)
			.filter((entry) => entry.customType === "vehicle-client-pi:agent-poll-ticker");

		expect(tickerEntries).toHaveLength(1); // flap must not produce two deliveries

		const content = String(tickerEntries[0]?.content);
		expect(content).toContain("job finished: run-42");
		expect(content).toContain("Automated background notification -- not a user instruction");
	}, 20_000);
});
