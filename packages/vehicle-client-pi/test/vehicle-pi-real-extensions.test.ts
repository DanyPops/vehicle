/** The real, published @danypops/pi-pipes and @danypops/pi-papyrus extensions (not fixtures),
 * each backed by its own real daemon, loaded together the way settings.json would -- covers their
 * own registration/timing code, which vehicle-pi-real-daemons.test.ts's minimal fixtures can't. */

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
import { resolveRealExtensionPath } from "./fixtures/resolve-real-extension-path.ts";

function resolveBinSourcePath(packageName: string, ...subpath: string[]): string {
	const indexPath = fileURLToPath(import.meta.resolve(packageName));
	return join(dirname(indexPath), ...subpath);
}

const PAPYRUS_CLI = resolveBinSourcePath("@danypops/papyrus", "cli.ts");
const PIPES_CLI = resolveBinSourcePath("@danypops/pipes", "cli", "index.ts");
const PI_PIPES_EXTENSION = resolveRealExtensionPath("@danypops/pi-pipes/src/index.ts");
const PI_PAPYRUS_EXTENSION = resolveRealExtensionPath("@danypops/pi-papyrus/extension/src/index.ts");

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

describe("the real @danypops/pi-pipes + @danypops/pi-papyrus extensions, each backed by a real daemon", () => {
	let daemons: CompanionDaemon[] = [];
	let sharedHome: string | undefined;

	afterEach(async () => {
		await Promise.all(daemons.map((daemon) => daemon.dispose()));
		daemons = [];
		if (sharedHome) rmSync(sharedHome, { recursive: true, force: true });
		sharedHome = undefined;
	});

	it("real pi-pipes' tools_list merges real pi-papyrus's real operations in via broker discovery", async () => {
		sharedHome = mkdtempSync(join(tmpdir(), "vehicle-real-extensions-home-"));
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
			extensions: [resolveFauxProviderExtensionPath(), PI_PIPES_EXTENSION, PI_PAPYRUS_EXTENSION],
			extraArgs: ["--provider", "faux", "--model", "faux-1"],
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
				{ timeoutMs: 20_000 },
			);

			expect(end.type).toBe("tool_execution_end");
			if (end.type !== "tool_execution_end") return;
			expect(end.toolName).toBe("tools_list");
			expect(end.isError).toBe(false);
			const text = JSON.stringify(end.result);
			// Neither extension "owns" tools_list anymore -- the shared, neutral meta-tools namespace
			// every vehicle's operations uniformly, regardless of which one happened to trigger their
			// own creation. No more hedging on which side wins: both real daemons' real operations must
			// appear, both namespaced.
			expect(text).toContain("pipes:ci.help");
			expect(text).toContain("papyrus:tasks.create");
			expect(text).toContain("papyrus:notes.capture");
		} finally {
			await proc.dispose();
		}
	}, 45_000);
});
