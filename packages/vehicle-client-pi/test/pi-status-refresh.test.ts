import { describe, expect, it } from "bun:test";
import { createExtensionHarness } from "@danypops/pi-extension-harness";
import { registerVehicleStatusRefresh } from "../src/pi-status-refresh.ts";

function harnessFor(options: Parameters<typeof registerVehicleStatusRefresh>[1]) {
	return createExtensionHarness((pi) => {
		registerVehicleStatusRefresh(pi, options);
	});
}

describe("registerVehicleStatusRefresh", () => {
	it("refreshes on session_start", async () => {
		let calls = 0;
		const h = harnessFor({ ownToolPrefixes: ["foo_"], refresh: () => void calls++ });
		await h.emit("session_start");
		expect(calls).toBe(1);
	});

	it("refreshes again after one of its own tools runs", async () => {
		let calls = 0;
		const h = harnessFor({ ownToolPrefixes: ["foo_"], refresh: () => void calls++ });
		await h.emit("tool_execution_end", { toolName: "foo_bar" });
		expect(calls).toBe(1);
	});

	it("ignores a tool call that isn't one of its own", async () => {
		let calls = 0;
		const h = harnessFor({ ownToolPrefixes: ["foo_"], refresh: () => void calls++ });
		await h.emit("tool_execution_end", { toolName: "read" });
		expect(calls).toBe(0);
	});

	it("matches against any of several prefixes", async () => {
		let calls = 0;
		const h = harnessFor({ ownToolPrefixes: ["foo_", "bar_"], refresh: () => void calls++ });
		await h.emit("tool_execution_end", { toolName: "bar_baz" });
		expect(calls).toBe(1);
	});

	it("swallows a refresh failure instead of throwing", async () => {
		const h = harnessFor({
			ownToolPrefixes: ["foo_"],
			refresh: () => {
				throw new Error("daemon unreachable");
			},
		});
		await expect(h.emit("session_start")).resolves.toBeUndefined();
	});

	it("swallows a rejected async refresh", async () => {
		const h = harnessFor({
			ownToolPrefixes: ["foo_"],
			refresh: async () => {
				throw new Error("daemon unreachable");
			},
		});
		await expect(h.emit("session_start")).resolves.toBeUndefined();
	});

	it("does not block session_start on a passive async refresh and exposes an explicit wait boundary", async () => {
		let release!: () => void;
		const blocked = new Promise<void>((resolve) => {
			release = resolve;
		});
		let handle!: ReturnType<typeof registerVehicleStatusRefresh>;
		const h = createExtensionHarness((pi) => {
			handle = registerVehicleStatusRefresh(pi, { ownToolPrefixes: ["foo_"], refresh: () => blocked });
		});

		await expect(h.emit("session_start")).resolves.toBeUndefined();
		let settled = false;
		void handle.waitForRefresh().then(() => {
			settled = true;
		});
		await Promise.resolve();
		expect(settled).toBe(false);

		release();
		await handle.waitForRefresh();
		expect(settled).toBe(true);
	});

	it("skips a detached startup refresh invalidated by session shutdown", async () => {
		let calls = 0;
		let handle!: ReturnType<typeof registerVehicleStatusRefresh>;
		const h = createExtensionHarness((pi) => {
			handle = registerVehicleStatusRefresh(pi, {
				ownToolPrefixes: ["foo_"],
				refresh: () => void calls++,
			});
		});

		const startup = h.emit("session_start");
		const shutdown = h.emit("session_shutdown");
		await Promise.all([startup, shutdown]);
		await handle.waitForRefresh();

		expect(calls).toBe(0);
	});
});
