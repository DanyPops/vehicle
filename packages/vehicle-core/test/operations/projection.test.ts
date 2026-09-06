import { expect, it } from "bun:test";
import { Type } from "typebox";
import type { VehicleClient } from "../../src/client/client.ts";
import { projectVehicleOperation } from "../../src/operations/projection.ts";
import { defineStrictVehicleOperation } from "../../src/typebox/index.ts";

const operation = defineStrictVehicleOperation({
	name: "records.list",
	version: 1,
	description: "Lists records.",
	input: Type.Object({ limit: Type.Integer({ minimum: 1, maximum: 4 }) }, { additionalProperties: false }),
	output: Type.Array(Type.String({ maxLength: 8 }), { maxItems: 4 }),
	permissions: ["records:read"],
	effect: "read",
	idempotency: { mode: "safe" },
	limits: { defaultTimeoutMs: 100, maxTimeoutMs: 1000, maxRequestBytes: 256, maxResponseBytes: 256 },
});

it("derives help and CLI validation from the operation", () => {
	const projection = projectVehicleOperation(operation);
	expect(JSON.parse(projection.help).operation).toEqual(operation.descriptor);
	expect(projection.parseArgs(["--input", '{"limit":2}', "--json"])).toEqual({ limit: 2 });
	for (const args of [
		["--input", '{"limit":5}'],
		["--input", "{"],
		["--input", "{}", "--input", "{}"],
		["--grant", "admin"],
		["--input", "x".repeat(300)],
	]) {
		expect(() => projection.parseArgs(args)).toThrow();
	}
});

it("rejects invalid strict operation metadata", () => {
	const options = { ...operation.descriptor, input: Type.Boolean(), output: Type.Boolean() };
	for (const override of [
		{ effect: "unknown" },
		{ idempotency: { mode: "unknown" } },
		{ requiresApproval: "yes" },
		{ limits: { defaultTimeoutMs: 10, maxTimeoutMs: 100 } },
		{ errors: Array.from({ length: 65 }, () => ({ code: "failure", description: "Failure." })) },
	])
		expect(() => defineStrictVehicleOperation({ ...options, ...override } as typeof options)).toThrow();
});

it("bounds projection admission", () => {
	expect(() =>
		projectVehicleOperation({
			...operation,
			descriptor: { ...operation.descriptor, limits: { ...operation.descriptor.limits, maxRequestBytes: 2 ** 30 } },
		}),
	).toThrow();
});

it("supports small scalar payload ceilings", () => {
	const scalar = defineStrictVehicleOperation({
		...operation.descriptor,
		input: Type.Boolean(),
		output: Type.Boolean(),
		permissions: [],
		limits: { ...operation.descriptor.limits, maxRequestBytes: 4, maxResponseBytes: 4 },
	});
	expect(projectVehicleOperation(scalar).parseArgs(["--input", "true"])).toBe(true);
});

it("forwards identity and invokes exactly once", async () => {
	let calls = 0;
	const controller = new AbortController();
	const options = { callerSessionId: "fixture-session", permissions: ["records:read"], signal: controller.signal };
	const client: VehicleClient = {
		manifest: async () => {
			throw new Error("unexpected manifest");
		},
		close: async () => {},
		async invoke<Output>(name: string, version: number, input: unknown, actualOptions?: unknown): Promise<Output> {
			calls++;
			expect([name, version, input]).toEqual(["records.list", 1, { limit: 2 }]);
			expect(actualOptions).toBe(options);
			return ["a"] as Output;
		},
	};
	const result: string[] = await projectVehicleOperation(operation).invoke(client, { limit: 2 }, options);
	expect(result).toEqual(["a"]);
	expect(calls).toBe(1);
});

it("rejects invalid inputs before dispatch and invalid outputs after dispatch", async () => {
	let calls = 0;
	const client: VehicleClient = {
		manifest: async () => {
			throw new Error("unused");
		},
		close: async () => {},
		async invoke<Output>(): Promise<Output> {
			calls++;
			return [123] as Output;
		},
	};
	const projection = projectVehicleOperation(operation);
	await expect(projection.invoke(client, { limit: 99 })).rejects.toMatchObject({ code: "invalid-input" });
	expect(calls).toBe(0);
	await expect(projection.invoke(client, { limit: 1 })).rejects.toMatchObject({ code: "invalid-output" });
	expect(calls).toBe(1);
});

it("preserves capacity and output failure categories", async () => {
	const projection = projectVehicleOperation(operation);
	const client: VehicleClient = {
		manifest: async () => {
			throw new Error("unused");
		},
		close: async () => {},
		async invoke<Output>(): Promise<Output> {
			return [123] as Output;
		},
	};
	await expect(projection.invoke(client, { limit: 2, extra: "x".repeat(300) } as { limit: number })).rejects.toMatchObject({
		code: "request-too-large",
		category: "capacity",
	});
	await expect(projection.invoke(client, { limit: 2 })).rejects.toMatchObject({ code: "invalid-output", category: "internal" });
	try {
		projection.parseArgs(["--input", JSON.stringify({ limit: 2, extra: "x".repeat(300) })]);
		throw new Error("Expected rejection");
	} catch (error) {
		expect(error).toMatchObject({ code: "request-too-large", category: "capacity" });
	}
});

it("preserves keyed mutation context through CLI dispatch", async () => {
	const mutation = defineStrictVehicleOperation({
		...operation.descriptor,
		input: Type.Object({}, { additionalProperties: false }),
		output: Type.Boolean(),
		effect: "external-write",
		idempotency: { mode: "keyed", retentionMs: 1000 },
	});
	let calls = 0;
	const options = { idempotencyKey: "fixture-key", permissions: [] };
	const client: VehicleClient = {
		manifest: async () => {
			throw new Error("unused");
		},
		close: async () => {},
		async invoke<Output>(_name: string, _version: number, _input: unknown, actualOptions?: unknown): Promise<Output> {
			calls++;
			expect(actualOptions).toBe(options);
			throw new Error("uncertain outcome");
		},
	};
	const projection = projectVehicleOperation(mutation);
	await expect(projection.invoke(client, projection.parseArgs(["--input", "{}"]), options)).rejects.toThrow("uncertain outcome");
	expect(calls).toBe(1);
});
