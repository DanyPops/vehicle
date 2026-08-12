/** Proves the in-process broker-discovery-stacking fix (vehicle-shell-registry.ts) survives a
 * real spawned `pi --mode rpc` process, not just the fake in-process harness in
 * vehicle-pi-shell.test.ts. */

import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	encodeFauxScript,
	resolveFauxProviderExtensionPath,
	SCRIPT_ENV_VAR,
	spawnRealPiProcess,
	waitForRpcEvent,
} from "@danypops/pi-process-harness";
import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";

const TWO_VEHICLES_EXTENSION = fileURLToPath(new URL("./fixtures/two-vehicles-broker-extension.ts", import.meta.url));

describe("registerVehicleTools broker discovery through a real spawned pi process", () => {
	it("tools_list, called by a real (faux-scripted) agent turn, merges the second vehicle's operations in via the in-process registry", async () => {
		// Isolates broker discovery's filesystem fallback to an empty dir so this test proves the
		// in-process registry path specifically, not whatever real Vehicle daemons happen to be
		// running on the machine that executes this test.
		const emptyHandleDir = mkdtempSync(join(tmpdir(), "vehicle-real-process-handles-"));
		const proc = spawnRealPiProcess({
			extensions: [resolveFauxProviderExtensionPath(), TWO_VEHICLES_EXTENSION],
			extraArgs: ["--provider", "faux", "--model", "faux-1"],
			env: {
				[SCRIPT_ENV_VAR]: encodeFauxScript([{ type: "toolCall", name: "tools_list", arguments: {} }]),
				XDG_RUNTIME_DIR: emptyHandleDir,
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
			expect(text).toContain("ci.status -- Run ci.status.");
			expect(text).toContain("papyrus:tasks.create -- Run tasks.create.");
			expect(text).toContain("papyrus:docs.create -- Run docs.create.");
		} finally {
			await proc.dispose();
			rmSync(emptyHandleDir, { recursive: true, force: true });
		}
	}, 20_000);
});
