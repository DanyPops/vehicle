#!/usr/bin/env bun
/**
 * A real, controllable Vehicle daemon for boot/in-place-update/Armada-swap E2E tests. Real HTTP,
 * handle file, bearer auth -- but its manifest is mutable live via its own real operations:
 *   fixture.ping           -- liveness probe.
 *   fixture.add_operation  -- registers a new operation live.
 *   fixture.set_available  -- toggles an existing operation's availability.
 *
 * FIXTURE_VEHICLE_NAME/FIXTURE_VEHICLE_VERSION identify this instance. FIXTURE_INITIAL_OPERATIONS
 * (JSON string array) seeds the boot-time manifest -- start a second instance with a different
 * list to simulate an Armada version swap. FIXTURE_START_DELAY_MS simulates a slow boot.
 * FIXTURE_EXIT_CODE simulates a crash. SIGTERM/SIGINT do a real graceful shutdown (handle removed).
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
