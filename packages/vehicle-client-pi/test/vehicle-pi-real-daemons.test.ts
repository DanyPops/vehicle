/**
 * The strongest real-world approximation of the live-session symptom this repo can construct and
 * fully control: two genuinely separate, independently-started Vehicle daemon PROCESSES (a real
 * `papyrus serve` and a real `pipes serve`, both real published packages, not fakes), discovered
 * by a real spawned `pi --mode rpc` process's real filesystem-handle broker discovery
 * (discoverForeignVehicles reading $XDG_RUNTIME_DIR/vehicle/handles/*.json) -- not the in-process
 * registry path vehicle-pi-real-process.test.ts already covers. Isolates HOME/XDG_* for both
 * daemons and the pi process into one shared temp dir so this never touches the real operator's
 * own papyrus/pipes state, but is otherwise the real thing end to end: real HTTP manifest fetch,
 * real Bearer-token auth, real handle files, real jiti-loaded extension.
 */

import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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
import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";

const TWO_REAL_DAEMONS_EXTENSION = fileURLToPath(new URL("./fixtures/two-real-daemons-broker-extension.ts", import.meta.url));

function resolveBinSourcePath(packageName: string, ...subpath: string[]): string {
	const indexPath = fileURLToPath(import.meta.resolve(packageName));
	return join(dirname(indexPath), ...subpath);
}

const PAPYRUS_CLI = resolveBinSourcePath("@danypops/papyrus", "cli.ts");
const PIPES_CLI = resolveBinSourcePath("@danypops/pipes", "cli", "index.ts");

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

describe("registerVehicleTools broker discovery across two real, separately-running Vehicle daemons", () => {
	let daemons: CompanionDaemon[] = [];
	let sharedHome: string | undefined;

	afterEach(async () => {
		await Promise.all(daemons.map((daemon) => daemon.dispose()));
		daemons = [];
		if (sharedHome) rmSync(sharedHome, { recursive: true, force: true });
		sharedHome = undefined;
	});

	it("tools_list, called by a real (faux-scripted) agent turn, merges papyrus's real operations into pipes' real broker listing", async () => {
		sharedHome = mkdtempSync(join(tmpdir(), "vehicle-real-daemons-home-"));
		const runtimeDir = join(sharedHome, "run");
		const sharedEnv = {
			HOME: sharedHome,
			XDG_RUNTIME_DIR: runtimeDir,
			XDG_DATA_HOME: join(sharedHome, "data"),
			XDG_STATE_HOME: join(sharedHome, "state"),
		};

		const papyrusHandle = join(runtimeDir, "vehicle", "handles", "papyrus.json");
		const pipesHandle = join(runtimeDir, "vehicle", "handles", "pipes.json");

		const papyrusDaemon = await spawnCompanionDaemon({
			command: "bun",
			args: [PAPYRUS_CLI, "serve"],
			env: sharedEnv,
			isReady: handleFileReady(papyrusHandle),
			readyTimeoutMs: 15_000,
		});
		daemons.push(papyrusDaemon);

		const pipesDaemon = await spawnCompanionDaemon({
			command: "bun",
			args: [PIPES_CLI, "serve"],
			env: sharedEnv,
			isReady: handleFileReady(pipesHandle),
			readyTimeoutMs: 15_000,
		});
		daemons.push(pipesDaemon);

		const proc = spawnRealPiProcess({
			extensions: [resolveFauxProviderExtensionPath(), TWO_REAL_DAEMONS_EXTENSION],
			extraArgs: ["--provider", "faux", "--model", "faux-1"],
			// isolatedHome (not the explicit HOME below) is the one source of truth for the pi
			// process's own HOME/PI_CODING_AGENT_DIR -- XDG_* still needs stating explicitly so this
			// process's own client-side handle discovery lands on the same directory the two
			// companion daemons above just wrote their handles into.
			isolatedHome: sharedHome,
			env: {
				XDG_RUNTIME_DIR: sharedEnv.XDG_RUNTIME_DIR,
				XDG_DATA_HOME: sharedEnv.XDG_DATA_HOME,
				XDG_STATE_HOME: sharedEnv.XDG_STATE_HOME,
				[SCRIPT_ENV_VAR]: encodeFauxScript([{ type: "toolCall", name: "tools_list", arguments: {} }]),
			},
		});

		try {
			const events: AgentSessionEvent[] = [];
			proc.onEvent((event) => events.push(event));
			proc.sendPrompt("go");

			const end = await waitForRpcEvent(
				events,
				(event): event is Extract<AgentSessionEvent, { type: "tool_execution_end" }> => event.type === "tool_execution_end",
				{ timeoutMs: 15_000 },
			);

			expect(end.type).toBe("tool_execution_end");
			if (end.type !== "tool_execution_end") return;
			expect(end.toolName).toBe("tools_list");
			expect(end.isError).toBe(false);
			const text = JSON.stringify(end.result);
			// pipes' own operations, unnamespaced (it's the tools_list/tools_man owner).
			expect(text).toContain("ci.help");
			// papyrus's real operations, merged in via broker discovery, namespaced "papyrus:<op>".
			expect(text).toContain("papyrus:tasks.create");
			expect(text).toContain("papyrus:notes.capture");
		} finally {
			await proc.dispose();
		}
	}, 40_000);
});
