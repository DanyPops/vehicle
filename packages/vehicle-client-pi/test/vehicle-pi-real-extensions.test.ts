/**
 * The closest reproduction of the actual live-session architecture this repo can build: the REAL,
 * published `@danypops/pi-pipes` and `@danypops/pi-papyrus` npm extensions (not a minimal fixture
 * standing in for them), each talking to its own real, separately-spawned daemon process, loaded
 * into one real spawned `pi --mode rpc` process exactly the way a real settings.json would (two
 * `--extension` entries). vehicle-pi-real-daemons.test.ts already proved the underlying broker
 * filesystem-discovery mechanism sound with minimal fixtures; this is the remaining, larger-surface
 * candidate -- something in pi-pipes' or pi-papyrus' own real extension code (registration timing,
 * session_start deferral, deps wiring) that a minimal fixture can't exercise.
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

		// pipes loads (and so wins the tools_list/tools_man ownership race) before papyrus --
		// matches the real live session's own observed load order/ownership exactly.
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
			// Whichever extension's own vehicle-client-pi copy actually attempts broker registration
			// wins the tools_list/tools_man ownership race (not necessarily load order -- an older
			// dependency copy that never enables broker mode at all simply never contends). Assert on
			// both real operations appearing SOMEWHERE, unnamespaced XOR namespaced, rather than
			// hardcoding which side wins.
			expect(text).toMatch(/(^|[\s"])(pipes:)?ci\.help\b/);
			expect(text).toMatch(/(^|[\s"])(papyrus:)?tasks\.create\b/);
			expect(text).toMatch(/(^|[\s"])(papyrus:)?notes\.capture\b/);
			// The real test: one side's ops are namespaced and the other's aren't -- proving an actual
			// cross-daemon broker merge happened, not just two independent, un-merged tool sets.
			const pipesNamespaced = text.includes("pipes:ci.help");
			const papyrusNamespaced = text.includes("papyrus:tasks.create");
			expect(pipesNamespaced !== papyrusNamespaced).toBe(true);
		} finally {
			await proc.dispose();
		}
	}, 45_000);
});
