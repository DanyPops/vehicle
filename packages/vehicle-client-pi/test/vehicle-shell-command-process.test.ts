import { expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	encodeFauxScript,
	resolveFauxProviderExtensionPath,
	resolvePiCliPath,
	SCRIPT_ENV_VAR,
	spawnRealPiProcess,
	waitForRpcEvent,
} from "@danypops/pi-process-harness";
import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";

it("supports the headless Pi CLI with JSON output", async () => {
	const home = mkdtempSync(join(tmpdir(), "vehicle-shell-cli-"));
	try {
		// Print mode waits for piped stdin to end before dispatching commands.
		const output = execFileSync(
			"bun",
			[
				resolvePiCliPath(),
				"--mode",
				"json",
				"--print",
				"--no-extensions",
				"-e",
				resolveFauxProviderExtensionPath(),
				"-e",
				fileURLToPath(new URL("./fixtures/two-vehicles-broker-extension.ts", import.meta.url)),
				"--provider",
				"faux",
				"--model",
				"faux-1",
				'/vehicle-tools list --json {"vehicle":"pipes","limit":1}',
			],
			{
				cwd: home,
				input: "",
				encoding: "utf8",
				timeout: 15_000,
				maxBuffer: 131_072,
				env: {
					...process.env,
					HOME: home,
					PI_CODING_AGENT_DIR: join(home, ".pi", "agent"),
					XDG_RUNTIME_DIR: join(home, "run"),
					[SCRIPT_ENV_VAR]: encodeFauxScript([{ type: "text", text: "unexpected model call" }]),
				},
			},
		);
		const events = output
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line));
		const message = events.find((event) => event.type === "message_end" && event.message?.customType === "vehicle-shell-command")?.message;
		expect(message).toBeDefined();
		const result = JSON.parse(message.content);
		expect(result.details.operations[0].name).toBe("pipes:ci.status");
		expect(events.some((event) => event.type === "agent_start")).toBe(false);
	} finally {
		rmSync(home, { recursive: true, force: true });
	}
}, 20_000);

it("runs session commands in real Pi without a model turn", async () => {
	const home = mkdtempSync(join(tmpdir(), "vehicle-shell-command-"));
	const proc = spawnRealPiProcess({
		extensions: [
			resolveFauxProviderExtensionPath(),
			fileURLToPath(new URL("./fixtures/two-vehicles-broker-extension.ts", import.meta.url)),
		],
		isolatedHome: home,
		extraArgs: ["--provider", "faux", "--model", "faux-1"],
		env: { XDG_RUNTIME_DIR: join(home, "run"), [SCRIPT_ENV_VAR]: encodeFauxScript([{ type: "text", text: "unexpected model call" }]) },
	});
	try {
		const events: AgentSessionEvent[] = [];
		proc.onEvent((event) => {
			if (events.length < 128) events.push(event);
		});
		async function command(args: string) {
			const offset = events.length;
			proc.sendPrompt(`/vehicle-tools ${args}`);
			const event = await waitForRpcEvent(
				events,
				(entry) => {
					return (
						events.indexOf(entry) >= offset &&
						entry.type === "message_end" &&
						entry.message.role === "custom" &&
						entry.message.customType === "vehicle-shell-command"
					);
				},
				{ timeoutMs: 15_000 },
			);
			if (event.type !== "message_end" || event.message.role !== "custom" || typeof event.message.content !== "string")
				throw new Error("missing command result");
			expect(Buffer.byteLength(event.message.content)).toBeLessThanOrEqual(65_536);
			return JSON.parse(event.message.content);
		}
		const help = await command("help --json");
		expect(help.details.scope).toBe("pi-session");
		const dormant = await command('type --json {"names":["pipes:ci.status"]}');
		expect(dormant.details.results[0].status).toBe("dormant");
		await command('man --json {"names":["pipes:ci.status"]}');
		const active = await command('type --json {"names":["pipes:ci.status"]}');
		expect(active.details.results[0].status).toBe("active");
		expect(events.some((event) => event.type === "agent_start")).toBe(false);
	} finally {
		await proc.dispose();
		rmSync(home, { recursive: true, force: true });
	}
}, 30_000);
