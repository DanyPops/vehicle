/**
 * Closes a real gap in this package's own existing "real spawned process" coverage:
 * vehicle-pi-real-process.test.ts and vehicle-pi-real-daemons.test.ts both call
 * registerVehicleTools() twice from ONE extension file's own factory -- never the real topology
 * every actual multi-consumer Pi install uses (pipes, tickets, papyrus, packed: each its own npm
 * package, each its own settings.json entry, each its own independently-loaded extension module).
 * This test spawns a real `pi --mode rpc` process with TWO genuinely separate extension files (see
 * fixtures/separate-vehicle-{a,b}-extension.ts), proving the shared, process-wide meta-tools
 * (ensureVehicleShellHandle in vehicle-shell.ts) work across Pi's real multi-extension loader, not
 * just a single module's own two sequential calls.
 */
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

const VEHICLE_A = fileURLToPath(new URL("./fixtures/separate-vehicle-a-extension.ts", import.meta.url));
const VEHICLE_B = fileURLToPath(new URL("./fixtures/separate-vehicle-b-extension.ts", import.meta.url));

describe("the shared meta-tools work across genuinely separate extension modules, not just one module's own two calls", () => {
	it("tools_list, called by a real (faux-scripted) agent turn, merges both independently-loaded vehicles' operations", async () => {
		const emptyHandleDir = mkdtempSync(join(tmpdir(), "vehicle-separate-extensions-handles-"));
		const proc = spawnRealPiProcess({
			extensions: [resolveFauxProviderExtensionPath(), VEHICLE_A, VEHICLE_B],
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
			// Both vehicles' operations appear, uniformly namespaced -- neither one is the
			// unprefixed "local" vehicle the old design would have made whichever loaded first.
			expect(text).toContain("vehicle-a:alpha.report -- Run alpha.report.");
			expect(text).toContain("vehicle-b:beta.report -- Run beta.report.");
		} finally {
			await proc.dispose();
			rmSync(emptyHandleDir, { recursive: true, force: true });
		}
	}, 20_000);
});
