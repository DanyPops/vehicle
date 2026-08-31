/**
 * Exercises the retry lifecycle in a real subprocess because a stale-context access can escape
 * after the test body yields. The shared extension harness supplies the same session shutdown and
 * context invalidation sequence Pi uses during reload and session replacement.
 */

import { afterAll, describe, expect, it } from "bun:test";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PACKAGE_ROOT = join(import.meta.dir, "..");
const dirs: string[] = [];

afterAll(() => {
	for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

const RETRY_DELAY_FIXTURE_BODY = `
import { createExtensionHarness } from "@danypops/pi-extension-harness";
import { registerVehicleToolsWhenReady } from ${JSON.stringify(join(PACKAGE_ROOT, "src", "vehicle-pi.ts"))};

const harness = createExtensionHarness(() => {});
const events = [];

function notifyReadyEvent(event) {
	events.push(event.kind);
	if (event.kind === "exhausted") {
		event.ctx.ui.notify(\`tools unavailable after \${event.attempts} attempts\`, "warning");
	}
}

registerVehicleToolsWhenReady(harness.api, () => Promise.resolve(undefined), {
	retry: { attempts: 2, initialDelayMs: 10, maxDelayMs: 10 },
	log: notifyReadyEvent,
});

await harness.emit("session_start");
await harness.emit("session_shutdown");
harness.invalidateCtx();

setTimeout(() => console.log("REACHED_END_WITHOUT_STALE_CALLBACK:" + events.join(",")), 300);
`;

const REGISTRATION_FIXTURE_BODY = `
import { createExtensionHarness } from "@danypops/pi-extension-harness";
import { registerVehicleToolsWhenReady } from ${JSON.stringify(join(PACKAGE_ROOT, "src", "vehicle-pi.ts"))};

const harness = createExtensionHarness(() => {});
const events = [];
let markManifestStarted;
const manifestStarted = new Promise((resolve) => { markManifestStarted = resolve; });
const client = {
	manifest() {
		markManifestStarted();
		return new Promise((_, reject) => setTimeout(() => reject(new Error("registration failed")), 50));
	},
};

registerVehicleToolsWhenReady(harness.api, () => Promise.resolve(client), {
	retry: { attempts: 1 },
	log(event) {
		events.push(event.kind);
		if (event.kind === "registration-failed" || event.kind === "exhausted") {
			event.ctx.ui.notify(event.kind, "warning");
		}
	},
});

await harness.emit("session_start");
await manifestStarted;
await harness.emit("session_shutdown");
harness.invalidateCtx();

setTimeout(() => console.log("REACHED_END_AFTER_REGISTRATION_CANCEL:" + events.join(",")), 300);
`;

function writeFixture(body: string): string {
	const dir = mkdtempSync(join(PACKAGE_ROOT, ".session-replacement-crash-"));
	dirs.push(dir);
	const path = join(dir, "repro.mjs");
	writeFileSync(path, body);
	return path;
}

/** Runs the fixture under the package's Bun host with workspace dependencies available. */
function runUnderBun(scriptPath: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
	return new Promise((resolvePromise) => {
		const child = spawn("bun", ["run", scriptPath], { cwd: PACKAGE_ROOT, stdio: ["ignore", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk) => {
			stdout += chunk.toString();
		});
		child.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});
		child.on("exit", (code) => resolvePromise({ code, stdout, stderr }));
	});
}

describe("registerVehicleToolsWhenReady retry lifecycle", () => {
	it("stops callbacks when the session shuts down", async () => {
		const result = await runUnderBun(writeFixture(RETRY_DELAY_FIXTURE_BODY));

		expect(result.code).toBe(0);
		expect(result.stderr).not.toContain("ctx is stale");
		expect(result.stderr).not.toContain("log callback threw");
		expect(result.stdout).toContain("REACHED_END_WITHOUT_STALE_CALLBACK:client-unavailable");
	}, 15_000);

	it("stops callbacks from in-flight registration", async () => {
		const result = await runUnderBun(writeFixture(REGISTRATION_FIXTURE_BODY));

		expect(result.code).toBe(0);
		expect(result.stderr).not.toContain("ctx is stale");
		expect(result.stderr).not.toContain("log callback threw");
		expect(result.stdout).toContain("REACHED_END_AFTER_REGISTRATION_CANCEL:");
	}, 15_000);
});
