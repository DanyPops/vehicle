#!/usr/bin/env bun
/**
 * A real, controllable Vehicle daemon for exercising "does tools_list/tools_man converge to
 * reality dynamically" -- on boot (including a slow-starting or never-starting vehicle), on an
 * in-place update (Packed's package.update + restart_service: same process, registry mutated
 * live), and on an Armada-style atomic replacement (old process killed, a new one started at a
 * new port with a different manifest, new handle file written).
 *
 * Real HTTP, real handle file, real bearer auth -- the same wire protocol any real Vehicle daemon
 * (papyrus, pipes, web-spider) speaks -- but with a manifest a test can mutate live through the
 * daemon's own real Vehicle operations, instead of needing a bespoke side-channel:
 *
 *   fixture.ping                    -- always present; a liveness probe distinct from tools_list.
 *   fixture.add_operation           -- registers a brand-new trivial operation live (a genuine
 *                                       vNext addition, not just re-enabling one declared at boot).
 *   fixture.set_available           -- toggles an existing operation's availability (simulates
 *                                       deprecating/hiding one without a restart).
 *
 * FIXTURE_VEHICLE_NAME (default "fixture"), FIXTURE_VEHICLE_VERSION (default "1.0.0"),
 * FIXTURE_INITIAL_OPERATIONS (JSON string array of names, seeded as trivial echo operations at
 * boot -- this is "what version am I" for the Armada-swap scenario: start a second instance with
 * a different list to stand in for a new release). FIXTURE_START_DELAY_MS delays writing the
 * handle file (simulates a slow-booting daemon for boot-race tests). FIXTURE_EXIT_CODE exits with
 * that code shortly after starting (simulates a crash-looping update). SIGTERM/SIGINT/the same
 * stdin fallback awaitGracefulShutdown already supports remove the handle file and exit 0 (a
 * real graceful stop, e.g. Armada tearing this instance down before starting its replacement).
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { bindVehicleOperation, defineVehicleOperation, defineVehicleSchema, type VehicleOperationBinding } from "@danypops/vehicle-core";
import { removeDaemonHandle, resolveSharedVehicleHandlePath, writeDaemonHandle } from "../../src/paths.ts";
import { awaitGracefulShutdown } from "../../src/supervisor.ts";
import { createVehicleHttpApp } from "../../src/vehicle-http-provider.ts";
import { VehicleRegistry } from "../../src/vehicle-registry.ts";

const NAME = process.env.FIXTURE_VEHICLE_NAME ?? "fixture";
const VERSION = process.env.FIXTURE_VEHICLE_VERSION ?? "1.0.0";
const START_DELAY_MS = Number(process.env.FIXTURE_START_DELAY_MS ?? "0");
const INITIAL_OPERATIONS: string[] = process.env.FIXTURE_INITIAL_OPERATIONS
	? (JSON.parse(process.env.FIXTURE_INITIAL_OPERATIONS) as string[])
	: [];

const anySchema = defineVehicleSchema<Record<string, unknown>>({
	jsonSchema: { type: "object" },
	safeParse: (value) => ({ success: true, value: (value ?? {}) as Record<string, unknown> }),
});

const LIMITS = { defaultTimeoutMs: 5_000, maxTimeoutMs: 30_000, maxRequestBytes: 65_536, maxResponseBytes: 65_536 };

function trivialOperationBinding(
	name: string,
	description: string,
): VehicleOperationBinding<Record<string, unknown>, Record<string, unknown>> {
	const operation = defineVehicleOperation({
		name,
		version: 1,
		description,
		input: anySchema,
		output: anySchema,
		permissions: [],
		effect: "read",
		idempotency: { mode: "safe" },
		limits: LIMITS,
	});
	return bindVehicleOperation(operation, () => async ({ input }) => ({ echoed: input }));
}

const registry = new VehicleRegistry({ name: NAME, version: VERSION, description: `Fixture Vehicle (${NAME}@${VERSION}).` });

for (const name of INITIAL_OPERATIONS) {
	registry.register("fixture-seed", trivialOperationBinding(name, `Seeded fixture operation ${name}.`));
}

const pingOperation = defineVehicleOperation({
	name: "fixture.ping",
	version: 1,
	description: "Liveness probe -- always present, unaffected by add_operation/set_available.",
	input: anySchema,
	output: anySchema,
	permissions: [],
	effect: "read",
	idempotency: { mode: "safe" },
	limits: LIMITS,
});
registry.register(
	"fixture-control",
	bindVehicleOperation(pingOperation, () => async () => ({ pong: true, name: NAME, version: VERSION })),
);

const addOperationSchema = defineVehicleSchema<{ name: string; description?: string }>({
	jsonSchema: { type: "object", properties: { name: { type: "string" }, description: { type: "string" } }, required: ["name"] },
	safeParse(value) {
		const record = value as { name?: unknown; description?: unknown };
		if (typeof record?.name !== "string" || !record.name)
			return { success: false, issues: [{ path: ["name"], message: "name is required" }] };
		return {
			success: true,
			value: { name: record.name, description: typeof record.description === "string" ? record.description : undefined },
		};
	},
});
const addOperation = defineVehicleOperation({
	name: "fixture.add_operation",
	version: 1,
	description: "Registers a brand-new trivial operation live -- a genuine vNext addition, not a re-enable.",
	input: addOperationSchema,
	output: anySchema,
	permissions: [],
	effect: "local-write",
	idempotency: { mode: "safe" },
	limits: LIMITS,
});
registry.register(
	"fixture-control",
	bindVehicleOperation(addOperation, () => async ({ input }) => {
		registry.register(
			"fixture-dynamic",
			trivialOperationBinding(input.name, input.description ?? `Dynamically added operation ${input.name}.`),
		);
		return { added: input.name };
	}),
);

const setAvailableSchema = defineVehicleSchema<{ name: string; version?: number; available: boolean; reason?: string }>({
	jsonSchema: {
		type: "object",
		properties: { name: { type: "string" }, version: { type: "number" }, available: { type: "boolean" }, reason: { type: "string" } },
		required: ["name", "available"],
	},
	safeParse(value) {
		const record = value as { name?: unknown; version?: unknown; available?: unknown; reason?: unknown };
		if (typeof record?.name !== "string" || !record.name)
			return { success: false, issues: [{ path: ["name"], message: "name is required" }] };
		if (typeof record.available !== "boolean")
			return { success: false, issues: [{ path: ["available"], message: "available is required" }] };
		return {
			success: true,
			value: {
				name: record.name,
				available: record.available,
				...(typeof record.version === "number" ? { version: record.version } : {}),
				...(typeof record.reason === "string" ? { reason: record.reason } : {}),
			},
		};
	},
});
const setAvailableOperation = defineVehicleOperation({
	name: "fixture.set_available",
	version: 1,
	description: "Toggles an existing operation's availability live -- simulates deprecating/hiding one without a restart.",
	input: setAvailableSchema,
	output: anySchema,
	permissions: [],
	effect: "local-write",
	idempotency: { mode: "safe" },
	limits: LIMITS,
});
registry.register(
	"fixture-control",
	bindVehicleOperation(setAvailableOperation, () => async ({ input }) => {
		registry.setAvailability(input.name, input.version ?? 1, input.available, input.reason);
		return { name: input.name, available: input.available };
	}),
);

function fixtureRuntimeDir(): string {
	return process.env.XDG_RUNTIME_DIR ?? tmpdir();
}

async function main(): Promise<void> {
	if (START_DELAY_MS > 0) await new Promise((resolve) => setTimeout(resolve, START_DELAY_MS));

	const token = randomBytes(32).toString("hex");
	const tokenPath = join(fixtureRuntimeDir(), "vehicle-fixture", NAME, "token");
	mkdirSync(dirname(tokenPath), { recursive: true, mode: 0o700 });
	writeFileSync(tokenPath, token, { mode: 0o600 });

	const app = createVehicleHttpApp({ registry, token });
	const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: app.fetch });
	const port = server.port;
	if (port === undefined) throw new Error("Bun.serve did not assign a port");

	const handlePath = resolveSharedVehicleHandlePath(NAME);
	writeDaemonHandle(handlePath, { host: "127.0.0.1", port, pid: process.pid, tokenPath });

	console.log(`fixture-vehicle-daemon: ${NAME}@${VERSION} listening on 127.0.0.1:${port} (pid ${process.pid})`);

	awaitGracefulShutdown(() => {
		removeDaemonHandle(handlePath);
		server.stop(true);
		process.exit(0);
	});

	if (process.env.FIXTURE_EXIT_CODE !== undefined) {
		setTimeout(() => process.exit(Number(process.env.FIXTURE_EXIT_CODE)), 30);
	}
}

await main();
