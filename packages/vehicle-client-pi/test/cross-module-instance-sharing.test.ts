import { afterEach, describe, expect, it } from "bun:test";
import type { VehicleClient, VehicleManifest } from "@danypops/vehicle-core";

/**
 * Proves the actual bug this guards against, not just the mechanism: several nested copies of
 * vehicle-client-pi really do get loaded in one process (confirmed live -- stripping the
 * ~/.cache/.bun/install/global overrides and running a real `bun install` resolved THREE
 * different vehicle-client-pi versions simultaneously across co-loaded pi-* extensions). A plain
 * `import` from two test files can't reproduce "two different module instances of the identical
 * file" -- Bun's module cache dedupes by resolved path. A cache-busting query string on a dynamic
 * import forces two genuinely separate module instances of the SAME source file instead, the
 * closest in-process stand-in for "two different resolved node_modules copies" available without
 * actually installing two versions.
 */

/**
 * A cache-busting query on a dynamic import's specifier is invisible to plain "bun test" (Bun
 * resolves it at runtime), but tsc's own static import-specifier resolution rejects it outright
 * (TS2307: no such module) since the literal string can't resolve to a real file on disk. A
 * template literal with a real interpolation (not just string concatenation, which tsc still
 * resolves statically) makes the whole expression untypeable, which is exactly what's wanted here
 * -- these imports are deliberately opaque to static analysis, the same way Bun resolves them.
 */
async function importFreshInstance(relativePath: string, tag: string): Promise<Record<string, unknown>> {
	return import(`${relativePath}?${tag}`);
}

const REGISTRY_KEY = Symbol.for("vehicle.shell.in-process-registry@1");
const ACTIVITY_KEY = Symbol.for("vehicle.pi.activity@1");
const HITL_KEY = Symbol.for("vehicle.pi.hitl-ask-pending@1");

afterEach(() => {
	delete (globalThis as Record<PropertyKey, unknown>)[REGISTRY_KEY];
	delete (globalThis as Record<PropertyKey, unknown>)[ACTIVITY_KEY];
	delete (globalThis as Record<PropertyKey, unknown>)[HITL_KEY];
});

describe("globalThis+Symbol.for() state survives being loaded as two separate module instances", () => {
	it("vehicle-shell-registry.ts: a vehicle registered through one module instance is visible through another", async () => {
		const a = await importFreshInstance("../src/vehicle-shell-registry.ts", "instance-a-shell-registry");
		const b = await importFreshInstance("../src/vehicle-shell-registry.ts", "instance-b-shell-registry");
		expect(a).not.toBe(b);

		const manifest: VehicleManifest = { name: "alpha", version: "1.0.0", description: "Alpha.", operations: [] };
		(a.registerInProcessVehicle as (name: string, manifest: VehicleManifest, client: VehicleClient, activate: () => string) => void)(
			"alpha",
			manifest,
			{} as VehicleClient,
			() => "unused",
		);

		const seenThroughB = (b.listInProcessVehicles as () => Array<{ name: string }>)().map((v) => v.name);
		expect(seenThroughB).toContain("alpha");
	});

	it("activity-broker.ts: a broker registered through one module instance receives events published through another", async () => {
		const a = await importFreshInstance("../src/activity-broker.ts", "instance-a-activity-broker");
		const b = await importFreshInstance("../src/activity-broker.ts", "instance-b-activity-broker");
		expect(a).not.toBe(b);

		const received: unknown[] = [];
		(a.registerActivityBroker as (broker: { publish: (event: unknown) => void }) => void)({
			publish: (event: unknown) => received.push(event),
		});

		(b.publishVehicleActivity as (event: unknown) => void)({
			type: "test",
			source: "vehicle",
			severity: "info",
			importance: "normal",
			summary: "hi",
		});
		expect(received).toHaveLength(1);
	});

	it("hitl-ask-typing-courtesy.ts: markAskPromptPending through one module instance is visible to isLiveAskPending through another -- the exact cross-extension coordination this counter exists for", async () => {
		const a = await importFreshInstance("../src/hitl-ask-typing-courtesy.ts", "instance-a-typing-courtesy");
		const b = await importFreshInstance("../src/hitl-ask-typing-courtesy.ts", "instance-b-typing-courtesy");
		expect(a).not.toBe(b);

		const isLiveAskPending = b.isLiveAskPending as () => boolean;
		const markAskPromptPending = a.markAskPromptPending as () => void;
		const markAskPromptSettled = a.markAskPromptSettled as () => void;

		expect(isLiveAskPending()).toBe(false);
		markAskPromptPending();
		expect(isLiveAskPending()).toBe(true);
		markAskPromptSettled();
		expect(isLiveAskPending()).toBe(false);
	});
});
