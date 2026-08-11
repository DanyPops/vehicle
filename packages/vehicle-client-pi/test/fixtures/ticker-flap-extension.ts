/** Drives the real AgentPollTicker/createAgentNotifier/reportAgentPollTick through a
 * present -> absent -> present -> absent flap, from session_start (no prompt needed). */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { AgentPollTicker, createAgentNotifier, reportAgentPollTick } from "../../src/agent-poll-ticker.ts";

interface Row {
	id: string;
}

export default function (pi: ExtensionAPI): void {
	pi.on("session_start", async () => {
		const ticker = new AgentPollTicker<Row>({
			key: (row) => row.id,
			buildVanishedMessage: (keys) => `job finished: ${keys.join(", ")}`,
		});
		const notifier = createAgentNotifier(pi);

		reportAgentPollTick(ticker, [{ id: "run-42" }], notifier); // baseline, silent
		reportAgentPollTick(ticker, [], notifier); // vanished -- reports once
		reportAgentPollTick(ticker, [{ id: "run-42" }], notifier); // flaps back
		reportAgentPollTick(ticker, [], notifier); // vanished again -- must stay silent
	});
}
