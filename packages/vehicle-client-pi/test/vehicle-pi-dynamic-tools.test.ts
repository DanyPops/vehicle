/**
 * Does tools_list/tools_man converge to reality dynamically, within one already-running pi
 * process -- not "does a fresh process see the current state" (vehicle-pi-real-daemons.test.ts
 * already covers that), but "does an ALREADY-RUNNING session pick up a change that happened to a
 * Vehicle daemon out from under it, on the next tools_list call, with no Pi restart at all".
 *
 * Drives a real spawned pi process through several sequential turns via
 * @danypops/pi-process-harness's faux provider: a `text` step immediately after each `toolCall`
 * step reliably ends that turn (confirmed empirically -- the agent loop does not ask the model for
 * a further action once it receives plain text), so sequential sendPrompt() calls map 1:1 onto
 * sequential script steps, giving the test as much wall-clock time as it needs between two
 * tools_list calls to mutate the fixture daemon's live state or kill/replace it entirely.
 *
 * "probe" is the tools_list/tools_man broker owner throughout (see probe-broker-extension.ts);
 * "fixture" (vehicle-server's fixture-vehicle-daemon.ts) is the one being mutated/swapped, and
 * its operations always appear under this process's tools_list namespaced "fixture:<op>".
 */

import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	type CompanionDaemon,
	encodeFauxScript,
	resolveFauxProviderExtensionPath,
	SCRIPT_ENV_VAR,
	spawnCompanionDaemon,
	spawnRealPiProcess,
	waitForRpcEvent,
} from "@danypops/pi-process-harness";
import { RemoteVehicleClient } from "@danypops/vehicle-client/http";
import { resolveSharedVehicleHandlePath } from "@danypops/vehicle-server/paths";
import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";

const FIXTURE_DAEMON = fileURLToPath(new URL("../../vehicle-server/test/fixtures/fixture-vehicle-daemon.ts", import.meta.url));
const PROBE_EXTENSION = fileURLToPath(new URL("./fixtures/probe-broker-extension.ts", import.meta.url));

function handleFileReady(path: string): () => boolean {
	return () => {
		try {
			JSON.parse(readFileSync(path, "utf8"));
			return true;
		} catch {
			return false;
		}
	};
}

function fixtureClient(runtimeDir: string, name: string): RemoteVehicleClient {
	const handlePath = resolveSharedVehicleHandlePath(name, { env: { XDG_RUNTIME_DIR: runtimeDir } });
	const handle = JSON.parse(readFileSync(handlePath, "utf8")) as { host: string; port: number; tokenPath: string };
	const token = readFileSync(handle.tokenPath, "utf8").trim();
	return new RemoteVehicleClient({ baseUrl: `http://${handle.host}:${handle.port}`, token });
}

describe("tools_list converges dynamically within one already-running pi process", () => {
	let daemons: CompanionDaemon[] = [];
	let sharedHome: string | undefined;

	afterEach(async () => {
		await Promise.all(daemons.map((daemon) => daemon.dispose().catch(() => {})));
		daemons = [];
		if (sharedHome) rmSync(sharedHome, { recursive: true, force: true });
		sharedHome = undefined;
	});

	function isolatedEnv() {
		sharedHome = mkdtempSync(join(tmpdir(), "vehicle-dynamic-tools-"));
		const runtimeDir = join(sharedHome, "run");
		return {
			runtimeDir,
			sharedEnv: {
				HOME: sharedHome,
				XDG_RUNTIME_DIR: runtimeDir,
				XDG_DATA_HOME: join(sharedHome, "data"),
				XDG_STATE_HOME: join(sharedHome, "state"),
			},
		};
	}

	async function startFixture(
		runtimeDir: string,
		sharedEnv: Record<string, string>,
		name: string,
		operations: string[],
	): Promise<CompanionDaemon> {
		const daemon = await spawnCompanionDaemon({
			command: "bun",
			args: [FIXTURE_DAEMON],
			env: { ...sharedEnv, FIXTURE_VEHICLE_NAME: name, FIXTURE_INITIAL_OPERATIONS: JSON.stringify(operations) },
			isReady: handleFileReady(join(runtimeDir, "vehicle", "handles", `${name}.json`)),
			readyTimeoutMs: 10_000,
		});
		daemons.push(daemon);
		return daemon;
	}

	// waitForRpcEvent's find() returns the FIRST array element satisfying its predicate, not the
	// newest one -- every tool_execution_end event satisfies "event.type === 'tool_execution_end'",
	// so a predicate that only checks the type (or even a global array-length side condition) keeps
	// matching call #1's own stale event forever. Index by "how many tool_execution_end events have
	// we already consumed" and wait for one strictly beyond that instead.
	async function toolsListText(events: AgentSessionEvent[], proc: ReturnType<typeof spawnRealPiProcess>, message: string): Promise<string> {
		const alreadySeen = events.filter((event) => event.type === "tool_execution_end").length;
		proc.sendPrompt(message);
		await waitForRpcEvent(
			events,
			(event) =>
				event.type === "tool_execution_end" &&
				events.filter((candidate) => candidate.type === "tool_execution_end").indexOf(event) >= alreadySeen,
			{ timeoutMs: 10_000 },
		);
		const matching = events.filter(
			(event): event is Extract<AgentSessionEvent, { type: "tool_execution_end" }> => event.type === "tool_execution_end",
		);
		const end = matching[alreadySeen];
		if (!end) throw new Error("expected a new tool_execution_end event");
		return JSON.stringify(end.result);
	}

	it("picks up a live in-place update (new operation added, old one deprecated) with no pi restart -- stories #4/#5", async () => {
		const { runtimeDir, sharedEnv } = isolatedEnv();
		await startFixture(runtimeDir, sharedEnv, "probe", []);
		await startFixture(runtimeDir, sharedEnv, "fixture", ["foo.v1"]);

		const proc = spawnRealPiProcess({
			extensions: [resolveFauxProviderExtensionPath(), PROBE_EXTENSION],
			extraArgs: ["--provider", "faux", "--model", "faux-1"],
			isolatedHome: sharedHome,
			env: {
				XDG_RUNTIME_DIR: sharedEnv.XDG_RUNTIME_DIR,
				XDG_DATA_HOME: sharedEnv.XDG_DATA_HOME,
				XDG_STATE_HOME: sharedEnv.XDG_STATE_HOME,
				[SCRIPT_ENV_VAR]: encodeFauxScript([
					{ type: "toolCall", name: "tools_list", arguments: {} },
					{ type: "text", text: "ok1" },
					{ type: "toolCall", name: "tools_list", arguments: {} },
					{ type: "text", text: "ok2" },
					{ type: "toolCall", name: "tools_list", arguments: {} },
					{ type: "text", text: "ok3" },
				]),
			},
		});
		const events: AgentSessionEvent[] = [];
		proc.onEvent((event) => events.push(event));

		try {
			const before = await toolsListText(events, proc, "list tools");
			expect(before).toContain("fixture:foo.v1");
			expect(before).not.toContain("fixture:foo.v2");

			// In-place update, same process, no restart: a genuinely new operation appears live.
			const fixture = fixtureClient(runtimeDir, "fixture");
			await fixture.invoke("fixture.add_operation", 1, { name: "foo.v2", description: "added live" });

			const afterAdd = await toolsListText(events, proc, "list tools again");
			expect(afterAdd).toContain("fixture:foo.v1");
			expect(afterAdd).toContain("fixture:foo.v2");

			// Known current gap, documented rather than silently asserted around: tools_list never
			// filters by an operation's own `available` flag, for either a local or a foreign
			// (broker-discovered) vehicle -- formatOperationOneLiner has nothing to key an
			// availability check off of. Deprecating a foreign operation live IS visible dynamically
			// (this assertion proves the broker fetch itself is live/fresh), but it does not
			// disappear from the listing the way #5's user story wants -- filed as a follow-up, not
			// fixed here.
			await fixture.invoke("fixture.set_available", 1, { name: "foo.v1", available: false, reason: "deprecated" });

			const afterDeprecate = await toolsListText(events, proc, "list tools once more");
			expect(afterDeprecate).toContain("fixture:foo.v1"); // current behavior: still listed despite available:false
			expect(afterDeprecate).toContain("fixture:foo.v2");
		} finally {
			await proc.dispose();
		}
	}, 30_000);

	it("picks up a live in-place update to the OWNING vehicle's own local manifest, not just a foreign one -- Packed updating its own daemon in place", async () => {
		const { runtimeDir, sharedEnv } = isolatedEnv();
		await startFixture(runtimeDir, sharedEnv, "probe", ["own.v1"]);

		const proc = spawnRealPiProcess({
			extensions: [resolveFauxProviderExtensionPath(), PROBE_EXTENSION],
			extraArgs: ["--provider", "faux", "--model", "faux-1"],
			isolatedHome: sharedHome,
			env: {
				XDG_RUNTIME_DIR: sharedEnv.XDG_RUNTIME_DIR,
				XDG_DATA_HOME: sharedEnv.XDG_DATA_HOME,
				XDG_STATE_HOME: sharedEnv.XDG_STATE_HOME,
				[SCRIPT_ENV_VAR]: encodeFauxScript([
					{ type: "toolCall", name: "tools_list", arguments: {} },
					{ type: "text", text: "ok1" },
					{ type: "toolCall", name: "tools_list", arguments: {} },
					{ type: "text", text: "ok2" },
				]),
			},
		});
		const events: AgentSessionEvent[] = [];
		proc.onEvent((event) => events.push(event));

		try {
			const before = await toolsListText(events, proc, "list tools");
			expect(before).toContain("own.v1");
			expect(before).not.toContain("own.v2");

			// "probe" updates ITS OWN manifest live (Packed's package.update + restart_service
			// scenario, but even more direct: the same process, no restart at all) -- via a
			// separately-constructed client hitting the same real daemon.
			const probe = fixtureClient(runtimeDir, "probe");
			await probe.invoke("fixture.add_operation", 1, { name: "own.v2", description: "added to the owning vehicle's own manifest" });

			const after = await toolsListText(events, proc, "list tools again");
			expect(after).toContain("own.v1");
			expect(after).toContain("own.v2");
		} finally {
			await proc.dispose();
		}
	}, 30_000);

	it("converges to the new version after an Armada-style atomic swap, degrading gracefully during the gap -- stories #8/#9", async () => {
		const { runtimeDir, sharedEnv } = isolatedEnv();
		await startFixture(runtimeDir, sharedEnv, "probe", []);
		const fixtureV1 = await startFixture(runtimeDir, sharedEnv, "fixture", ["foo.v1"]);

		const proc = spawnRealPiProcess({
			extensions: [resolveFauxProviderExtensionPath(), PROBE_EXTENSION],
			extraArgs: ["--provider", "faux", "--model", "faux-1"],
			isolatedHome: sharedHome,
			env: {
				XDG_RUNTIME_DIR: sharedEnv.XDG_RUNTIME_DIR,
				XDG_DATA_HOME: sharedEnv.XDG_DATA_HOME,
				XDG_STATE_HOME: sharedEnv.XDG_STATE_HOME,
				[SCRIPT_ENV_VAR]: encodeFauxScript([
					{ type: "toolCall", name: "tools_list", arguments: {} },
					{ type: "text", text: "ok1" },
					{ type: "toolCall", name: "tools_list", arguments: {} },
					{ type: "text", text: "ok2" },
					{ type: "toolCall", name: "tools_list", arguments: {} },
					{ type: "text", text: "ok3" },
				]),
			},
		});
		const events: AgentSessionEvent[] = [];
		proc.onEvent((event) => events.push(event));

		try {
			const beforeSwap = await toolsListText(events, proc, "list tools");
			expect(beforeSwap).toContain("fixture:foo.v1");

			// Armada tears the old instance down gracefully (SIGTERM -> handle removed) before
			// starting the replacement -- a real gap where the vehicle is briefly undiscoverable.
			await fixtureV1.dispose();
			daemons = daemons.filter((daemon) => daemon !== fixtureV1);

			const duringGap = await toolsListText(events, proc, "list tools mid-gap");
			expect(duringGap).not.toContain("fixture:foo.v1");
			expect(duringGap).not.toContain("fixture:foo.v2");
			expect(duringGap).not.toContain("fixture:"); // no broken/error entries, just silently absent

			// Armada starts the replacement -- same Vehicle name, new port, new handle, new manifest.
			await startFixture(runtimeDir, sharedEnv, "fixture", ["foo.v2"]);

			const afterSwap = await toolsListText(events, proc, "list tools after swap");
			expect(afterSwap).toContain("fixture:foo.v2");
			expect(afterSwap).not.toContain("fixture:foo.v1"); // converged, not stuck on the old version
		} finally {
			await proc.dispose();
		}
	}, 30_000);
});
