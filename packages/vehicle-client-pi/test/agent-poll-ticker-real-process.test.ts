/**
 * Real-process regression: agent-poll-ticker.test.ts covers AgentPollTicker's dedup/framing logic
 * against a plain class; this covers the same guarantee through the real delivery seam -- a real
 * extension in a real spawned `pi --mode rpc` process, via real pi.sendMessage() -> session entries.
 */
import { describe, expect, it } from "bun:test";
import { fileURLToPath } from "node:url";
import {
	encodeFauxScript,
	resolveFauxProviderExtensionPath,
	SCRIPT_ENV_VAR,
	spawnRealPiProcess,
	waitForRpcEvent,
} from "@danypops/pi-process-harness";
import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";

const TICKER_FLAP_EXTENSION = fileURLToPath(new URL("./fixtures/ticker-flap-extension.ts", import.meta.url));
const TICKER_DURING_BLOCKING_TURN_EXTENSION = fileURLToPath(
	new URL("./fixtures/ticker-during-blocking-turn-extension.ts", import.meta.url),
);

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

interface CustomEntry {
	type: "custom";
	customType: string;
	data?: unknown;
}

function isCustomEntry(entry: unknown): entry is CustomEntry {
	return typeof entry === "object" && entry !== null && (entry as { type?: unknown }).type === "custom";
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

	it("must not fire or queue a vanish notification for a job that died while a tool call -- and the whole turn -- was still actively executing", async () => {
		const proc = spawnRealPiProcess({
			extensions: [resolveFauxProviderExtensionPath(), TICKER_DURING_BLOCKING_TURN_EXTENSION],
			extraArgs: ["--provider", "faux", "--model", "faux-1"],
			env: { [SCRIPT_ENV_VAR]: encodeFauxScript([{ type: "toolCall", name: "slow_tool", arguments: {} }]) },
		});
		const events: AgentSessionEvent[] = [];
		proc.onEvent((event) => events.push(event));
		proc.sendPrompt("go");

		await waitForRpcEvent(
			events,
			(event): event is Extract<AgentSessionEvent, { type: "tool_execution_end" }> => event.type === "tool_execution_end",
			{
				timeoutMs: 15_000,
			},
		);

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

		// The repro's own precondition: both ticks genuinely fired while the turn was blocking, not
		// merely assumed -- ctx.isIdle() is the real ExtensionContext signal, read from inside the
		// slow tool's own execute(), not inferred indirectly.
		const idleMarkers = entries.filter(isCustomEntry).filter((entry) => entry.customType === "debug:idle-during-tool");
		expect(idleMarkers.map((entry) => (entry.data as { isIdle: boolean }).isIdle)).toEqual([false, false]);

		const tickerEntries = entries
			.filter(isCustomMessageEntry)
			.filter((entry) => entry.customType === "vehicle-client-pi:agent-poll-ticker");
		expect(tickerEntries).toHaveLength(0); // must stay silent: the job died mid-blocking-turn, never observed while idle
	}, 20_000);
});
