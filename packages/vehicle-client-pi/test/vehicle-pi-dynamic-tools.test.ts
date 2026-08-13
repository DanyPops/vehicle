/**
 * Does an already-running pi process pick up a Vehicle daemon change out from under it, with no
 * Pi restart? Drives one real spawned pi process through several turns: a `text` step right after
 * each `toolCall` ends that turn, so sequential sendPrompt() calls map 1:1 onto script steps,
 * leaving as much time as needed between two tools_list calls to mutate/kill/replace a daemon.
 *
 * "probe" and "fixture" (fixture-vehicle-daemon.ts) are both plain vehicles now -- neither owns
 * the shared meta-tools, which are neutral; every operation from both appears namespaced
 * ("probe:<op>", "fixture:<op>"). "fixture" is the one mutated/swapped across these stories.
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

	// find() returns the first match, not the newest -- index by how many we've already consumed.
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

			// Same process, no restart: a new operation appears live.
			const fixture = fixtureClient(runtimeDir, "fixture");
			await fixture.invoke("fixture.add_operation", 1, { name: "foo.v2", description: "added live" });

			const afterAdd = await toolsListText(events, proc, "list tools again");
			expect(afterAdd).toContain("fixture:foo.v1");
			expect(afterAdd).toContain("fixture:foo.v2");

			// Deprecating live is visible dynamically; stays listed but annotated (never vanishes).
			await fixture.invoke("fixture.set_available", 1, { name: "foo.v1", available: false, reason: "deprecated" });

			const afterDeprecate = await toolsListText(events, proc, "list tools once more");
			expect(afterDeprecate).toContain("fixture:foo.v1 -- Seeded fixture operation foo.v1. (currently unavailable: deprecated)");
			expect(afterDeprecate).toContain("fixture:foo.v2");
		} finally {
			await proc.dispose();
		}
	}, 30_000);

	it("picks up a live in-place update to any vehicle's own manifest, not just another vehicle's -- Packed updating its own daemon in place", async () => {
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
			expect(before).toContain("probe:own.v1");
			expect(before).not.toContain("probe:own.v2");

			// "probe" updates its own manifest live, no restart.
			const probe = fixtureClient(runtimeDir, "probe");
			await probe.invoke("fixture.add_operation", 1, { name: "own.v2", description: "added to its own manifest" });

			const after = await toolsListText(events, proc, "list tools again");
			expect(after).toContain("probe:own.v1");
			expect(after).toContain("probe:own.v2");
		} finally {
			await proc.dispose();
		}
	}, 30_000);

	it("tools_man activates a genuinely new operation added live to a vehicle's own manifest, making it actually callable", async () => {
		const { runtimeDir, sharedEnv } = isolatedEnv();
		await startFixture(runtimeDir, sharedEnv, "probe", []);

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
					{ type: "text", text: "ok0" },
					{ type: "toolCall", name: "tools_man", arguments: { names: ["probe:own.v2"] } },
					{ type: "text", text: "ok1" },
					{ type: "toolCall", name: "probe_own_v2", arguments: {} },
					{ type: "text", text: "ok2" },
				]),
			},
		});
		const events: AgentSessionEvent[] = [];
		proc.onEvent((event) => events.push(event));

		try {
			// Baseline avoids a race with the extension's own async registration seeing own.v2 first.
			const baseline = await toolsListText(events, proc, "list tools first");
			expect(baseline).not.toContain("probe:own.v2");

			// Added live, after registration.
			const probe = fixtureClient(runtimeDir, "probe");
			await probe.invoke("fixture.add_operation", 1, { name: "own.v2", description: "added to its own manifest" });

			const manPage = await toolsListText(events, proc, "activate probe:own.v2");
			expect(manPage).not.toContain("no such operation");
			expect(manPage).toContain("now callable as probe_own_v2");

			// Proves it's genuinely callable, not just claimed.
			const callResult = await toolsListText(events, proc, "call the newly-activated tool");
			expect(callResult).toContain("echoed");
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

			// Graceful teardown (handle removed) before the replacement starts -- a real gap.
			await fixtureV1.dispose();
			daemons = daemons.filter((daemon) => daemon !== fixtureV1);

			const duringGap = await toolsListText(events, proc, "list tools mid-gap");
			expect(duringGap).not.toContain("fixture:foo.v1");
			expect(duringGap).not.toContain("fixture:foo.v2");
			expect(duringGap).not.toContain("fixture:"); // no broken/error entries, just silently absent

			// Same name, new port/handle/manifest.
			await startFixture(runtimeDir, sharedEnv, "fixture", ["foo.v2"]);

			const afterSwap = await toolsListText(events, proc, "list tools after swap");
			expect(afterSwap).toContain("fixture:foo.v2");
			expect(afterSwap).not.toContain("fixture:foo.v1"); // converged, not stuck on the old version
		} finally {
			await proc.dispose();
		}
	}, 30_000);
});
