/**
 * Reproduces the filed pi-pipes bug hypothesis directly: nothing at today's reportAgentPollTick()
 * call site ever consults ExtensionContext.isIdle() before deciding to notify, so a background
 * poll landing while a tool call -- and therefore the whole turn -- is still actively executing
 * queues a "this job just finished" message based on data collected before the turn's own real
 * state is settled, instead of silently deferring to the next post-idle tick.
 *
 * `slow_tool` holds the turn open across two ticks: a baseline (job alive) and a vanish (job died
 * mid-flight), both fired from inside execute() -- i.e. provably while ctx.isIdle() is false, the
 * real ExtensionContext signal for "a turn is currently blocking", not a guess. Each tick's own
 * ctx.isIdle() reading is recorded as a plain custom entry so the test can assert the repro's own
 * precondition (never idle) held, independent of whatever the ticker itself did.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { AgentPollTicker, createAgentNotifier, reportAgentPollTick } from "../../src/agent-poll-ticker.ts";

interface Row {
	id: string;
}

export default function (pi: ExtensionAPI): void {
	const ticker = new AgentPollTicker<Row>({
		key: (row) => row.id,
		buildVanishedMessage: (keys) => `job finished: ${keys.join(", ")}`,
	});
	const notifier = createAgentNotifier(pi);

	pi.registerTool({
		name: "slow_tool",
		label: "Slow",
		description: "Holds a turn open while a background job dies mid-flight, reproducing the ticker-during-a-blocking-turn bug.",
		parameters: Type.Object({}),
		async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
			pi.appendEntry("debug:idle-during-tool", { phase: "baseline", isIdle: ctx.isIdle() });
			reportAgentPollTick(ticker, [{ id: "run-42" }], notifier, { isIdle: () => ctx.isIdle() }); // baseline tick, mid-turn: job alive, silent either way
			await new Promise((resolve) => setTimeout(resolve, 200));
			pi.appendEntry("debug:idle-during-tool", { phase: "vanished", isIdle: ctx.isIdle() });
			reportAgentPollTick(ticker, [], notifier, { isIdle: () => ctx.isIdle() }); // the job died WHILE this tool call is still in flight
			return { content: [{ type: "text", text: "done" }], details: {} };
		},
	});
}
