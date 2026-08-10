/**
 * TDD: written before src/agent-poll-ticker.ts exists.
 *
 * Ported and generalized from @danypops/pi-pipes' own job-ticker.ts/jobs-overlay.ts (a
 * ci_subscribe'd job's status transition reaching the agent, not just a widget) after finding a
 * second, independent hand-rolled version of the same problem in pi-papyrus's own
 * ActiveTaskContinuation -- the "confirmed twice, extract it" bar this package's other modules
 * (pi-status-refresh.ts, vehicle-watched-refresh.ts) were each built past.
 */
import { describe, expect, it } from "bun:test";
import { createExtensionHarness } from "@danypops/pi-extension-harness";
import { AgentPollTicker, createAgentNotifier, reportAgentPollTick } from "../src/agent-poll-ticker.ts";

interface Row {
	id: string;
	label: string;
}

function row(id: string, label = id): Row {
	return { id, label };
}

describe("AgentPollTicker", () => {
	it("says nothing on the very first tick, even with active rows -- no prior baseline to diff against, and too soon for a reminder", () => {
		const ticker = new AgentPollTicker<Row>({
			key: (r) => r.id,
			buildVanishedMessage: (keys) => `gone: ${keys.join(", ")}`,
			buildReminderMessage: (rows) => `still going: ${rows.map((r) => r.id).join(", ")}`,
			now: () => 0,
		});
		expect(ticker.tick([row("a")])).toBeUndefined();
	});

	it("says nothing when there is nothing tracked and nothing was ever tracked", () => {
		const ticker = new AgentPollTicker<Row>({
			key: (r) => r.id,
			buildVanishedMessage: (keys) => `gone: ${keys.join(", ")}`,
			now: () => 0,
		});
		expect(ticker.tick([])).toBeUndefined();
		expect(ticker.tick([])).toBeUndefined();
	});

	it("immediately reports a row that disappears between two ticks, regardless of elapsed time", () => {
		let now = 0;
		const ticker = new AgentPollTicker<Row>({
			key: (r) => r.id,
			buildVanishedMessage: (keys) => `gone: ${keys.join(", ")}`,
			now: () => now,
		});
		ticker.tick([row("a")]); // baseline

		now += 1; // barely any time has passed -- must not matter for a vanish report
		expect(ticker.tick([])).toBe("gone: a");
	});

	it("reports every row that vanished in the same tick together, one message", () => {
		let now = 0;
		const ticker = new AgentPollTicker<Row>({
			key: (r) => r.id,
			buildVanishedMessage: (keys) => `gone: ${keys.sort().join(", ")}`,
			now: () => now,
		});
		ticker.tick([row("a"), row("b")]);

		now += 1;
		expect(ticker.tick([])).toBe("gone: a, b");
	});

	it("does not report a reminder before reminderIntervalMs has elapsed since the ticker started", () => {
		let now = 0;
		const ticker = new AgentPollTicker<Row>({
			key: (r) => r.id,
			buildVanishedMessage: () => "gone",
			buildReminderMessage: () => "reminder",
			reminderIntervalMs: 1000,
			now: () => now,
		});
		ticker.tick([row("a")]); // first tick: no baseline yet

		now = 999;
		expect(ticker.tick([row("a")])).toBeUndefined();
	});

	it("reports a reminder once reminderIntervalMs has elapsed with nothing to report as vanished", () => {
		let now = 0;
		const ticker = new AgentPollTicker<Row>({
			key: (r) => r.id,
			buildVanishedMessage: () => "gone",
			buildReminderMessage: (rows) => `reminder: ${rows.map((r) => r.id).join(",")}`,
			reminderIntervalMs: 1000,
			now: () => now,
		});
		ticker.tick([row("a")]);

		now = 1000;
		expect(ticker.tick([row("a")])).toBe("reminder: a");
	});

	it("resets the reminder clock after firing -- does not fire again on the very next tick", () => {
		let now = 0;
		const ticker = new AgentPollTicker<Row>({
			key: (r) => r.id,
			buildVanishedMessage: () => "gone",
			buildReminderMessage: () => "reminder",
			reminderIntervalMs: 1000,
			now: () => now,
		});
		ticker.tick([row("a")]);
		now = 1000;
		expect(ticker.tick([row("a")])).toBe("reminder");

		now = 1001;
		expect(ticker.tick([row("a")])).toBeUndefined();

		now = 2000;
		expect(ticker.tick([row("a")])).toBe("reminder");
	});

	it("prefers reporting a vanish over a reminder when both would otherwise fire on the same tick", () => {
		let now = 0;
		const ticker = new AgentPollTicker<Row>({
			key: (r) => r.id,
			buildVanishedMessage: (keys) => `gone: ${keys.join(",")}`,
			buildReminderMessage: (rows) => `reminder: ${rows.map((r) => r.id).join(",")}`,
			reminderIntervalMs: 1000,
			now: () => now,
		});
		ticker.tick([row("a"), row("b")]);

		now = 1000; // reminder is also due now
		expect(ticker.tick([row("b")])).toBe("gone: a"); // one vanished -- reported instead of a reminder
	});

	it("never reports a reminder when buildReminderMessage is omitted -- vanish-only mode", () => {
		let now = 0;
		const ticker = new AgentPollTicker<Row>({
			key: (r) => r.id,
			buildVanishedMessage: () => "gone",
			now: () => now,
		});
		ticker.tick([row("a")]);
		now = 10_000_000;
		expect(ticker.tick([row("a")])).toBeUndefined();
	});

	it("defaults reminderIntervalMs to a multi-minute value so a background item does not nag every fast poll", () => {
		let now = 0;
		const ticker = new AgentPollTicker<Row>({
			key: (r) => r.id,
			buildVanishedMessage: () => "gone",
			buildReminderMessage: () => "reminder",
			now: () => now,
		});
		ticker.tick([row("a")]);
		now = 15_000; // a fast 15s widget-poll cadence, well under any sane default
		expect(ticker.tick([row("a")])).toBeUndefined();
	});
});

describe("reportAgentPollTick", () => {
	function fakeNotifier() {
		const calls: Array<{ content: string; options?: { deliverAs?: "steer" | "followUp" } }> = [];
		return {
			calls,
			sendUserMessage: (content: string, options?: { deliverAs?: "steer" | "followUp" }) => calls.push({ content, options }),
		};
	}

	it("does nothing when there is no notifier", () => {
		const ticker = new AgentPollTicker<Row>({ key: (r) => r.id, buildVanishedMessage: () => "gone", now: () => 0 });
		expect(() => reportAgentPollTick(ticker, [row("a")], undefined)).not.toThrow();
	});

	it("delivers the ticker's message through the notifier with deliverAs: followUp by default -- gentle, never forces an immediate turn", () => {
		const ticker = new AgentPollTicker<Row>({ key: (r) => r.id, buildVanishedMessage: (keys) => `gone: ${keys.join(",")}`, now: () => 0 });
		const notifier = fakeNotifier();

		reportAgentPollTick(ticker, [row("a")], notifier); // baseline
		reportAgentPollTick(ticker, [], notifier); // vanished

		expect(notifier.calls).toEqual([{ content: "gone: a", options: { deliverAs: "followUp" } }]);
	});

	it("honors a caller-supplied deliverAs override", () => {
		const ticker = new AgentPollTicker<Row>({ key: (r) => r.id, buildVanishedMessage: () => "gone", now: () => 0 });
		const notifier = fakeNotifier();
		reportAgentPollTick(ticker, [row("a")], notifier);
		reportAgentPollTick(ticker, [], notifier, { deliverAs: "followUp" });
		expect(notifier.calls).toEqual([{ content: "gone", options: { deliverAs: "followUp" } }]);
	});

	it("never throws when the ticker itself throws", () => {
		const ticker = {
			tick: () => {
				throw new Error("boom");
			},
		} as unknown as AgentPollTicker<Row>;
		const notifier = fakeNotifier();
		expect(() => reportAgentPollTick(ticker, [row("a")], notifier)).not.toThrow();
		expect(notifier.calls).toEqual([]);
	});

	it("never throws when the notifier itself throws", () => {
		const ticker = new AgentPollTicker<Row>({ key: (r) => r.id, buildVanishedMessage: () => "gone", now: () => 0 });
		ticker.tick([row("a")]);
		const notifier = {
			sendUserMessage: () => {
				throw new Error("session is mid-shutdown");
			},
		};
		expect(() => reportAgentPollTick(ticker, [], notifier)).not.toThrow();
	});
});

describe("createAgentNotifier", () => {
	it("forwards to the real pi.sendMessage -- verified through a real ExtensionAPI stub, not a hand-rolled fake", async () => {
		// pi.sendMessage(), not pi.sendUserMessage(): a background poll's own notification is not
		// "as if typed by the user", and (unlike sendUserMessage, which always triggers a turn)
		// sendMessage is gentle by default -- deliverAs "followUp"/"nextTurn" only force an immediate
		// turn when triggerTurn is explicitly true, which this never sets.
		const h = createExtensionHarness(() => {});
		const notifier = createAgentNotifier(h.api);

		notifier.sendUserMessage("hello", { deliverAs: "steer" });

		expect(h.sentMessages).toEqual([
			{ message: { customType: "vehicle-client-pi:agent-poll-ticker", content: "hello", display: true }, options: { deliverAs: "steer" } },
		]);
		expect(h.userMessages).toEqual([]); // never the always-turn-triggering sendUserMessage channel
	});
});
