import { describe, expect, it } from "bun:test";
import {
	bindVehicleOperation,
	defineVehicleOperation,
	defineVehicleSchema,
	VehicleError,
	type VehicleFailureDescriptor,
} from "@danypops/vehicle-core";
import type { VehicleIdempotencyPersistedSnapshot, VehicleIdempotencyPersistenceAdapter } from "../src/vehicle-idempotency-persistence.ts";
import { VehicleIdempotencyPolicy } from "../src/vehicle-idempotency-policy.ts";
import { VehicleRegistry } from "../src/vehicle-registry.ts";

const passthroughSchema = defineVehicleSchema<Record<string, unknown>>({
	jsonSchema: { type: "object" },
	safeParse: (value) => ({ success: true, value: (value ?? {}) as Record<string, unknown> }),
});

const LIMITS = { defaultTimeoutMs: 1_000, maxTimeoutMs: 5_000, maxRequestBytes: 4_096, maxResponseBytes: 4_096 } as const;

function keyedOperation(name: string, options: { retentionMs?: number; errors?: readonly VehicleFailureDescriptor[] } = {}) {
	return defineVehicleOperation({
		name,
		version: 1,
		description: "Test keyed mutation.",
		input: passthroughSchema,
		output: passthroughSchema,
		permissions: [],
		effect: "external-write",
		requiresApproval: false,
		idempotency: { mode: "keyed", retentionMs: options.retentionMs ?? 60_000 },
		limits: LIMITS,
		errors: options.errors ?? [],
	});
}

const safeOperation = defineVehicleOperation({
	name: "test.safe",
	version: 1,
	description: "Test non-keyed op.",
	input: passthroughSchema,
	output: passthroughSchema,
	permissions: [],
	effect: "read",
	idempotency: { mode: "safe" },
	limits: LIMITS,
});

/** Exposes resolve/reject and a call counter to the test, instead of racing real timers -- mirrors vehicle-job-store.test.ts's own deferredJob(). */
function deferredHandler(operation: ReturnType<typeof keyedOperation>) {
	let resolveHandler!: (output: unknown) => void;
	let rejectHandler!: (error: unknown) => void;
	let callCount = 0;
	const binding = bindVehicleOperation(operation, () => () => {
		callCount++;
		return new Promise<unknown>((resolve, reject) => {
			resolveHandler = resolve;
			rejectHandler = reject;
		});
	});
	return {
		binding,
		resolve: (output: unknown) => resolveHandler(output),
		reject: (error: unknown) => rejectHandler(error),
		get callCount() {
			return callCount;
		},
	};
}

// biome-ignore lint/suspicious/noExplicitAny: a test fixture registering operations of genuinely different Input/Output shapes.
function registryWithPolicy(policy: VehicleIdempotencyPolicy, ...bindings: any[]): VehicleRegistry {
	const registry = new VehicleRegistry({ name: "test", version: "1", description: "Test." });
	registry.setExecutionPolicy(policy);
	for (const binding of bindings) registry.register("test-owner", binding);
	return registry;
}

function flush(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

/** In-memory stand-in for a real file-backed adapter -- mirrors vehicle-job-store.test.ts's own memoryPersistence(). */
function memoryPersistence(): VehicleIdempotencyPersistenceAdapter & { saved?: VehicleIdempotencyPersistedSnapshot; saveCount: number } {
	const adapter = {
		saved: undefined as VehicleIdempotencyPersistedSnapshot | undefined,
		saveCount: 0,
		async save(snapshot: VehicleIdempotencyPersistedSnapshot) {
			adapter.saved = snapshot;
			adapter.saveCount++;
		},
		async load() {
			return adapter.saved;
		},
	};
	return adapter;
}

describe("VehicleIdempotencyPolicy: pass-through for non-keyed operations", () => {
	it("never touches an operation whose idempotency mode isn't 'keyed', even with an idempotencyKey supplied", async () => {
		let callCount = 0;
		const binding = bindVehicleOperation(safeOperation, () => async () => {
			callCount++;
			return { n: callCount };
		});
		const registry = registryWithPolicy(new VehicleIdempotencyPolicy(), binding);
		const first = await registry.invoke("test.safe", 1, {}, { idempotencyKey: "same-key" });
		const second = await registry.invoke("test.safe", 1, {}, { idempotencyKey: "same-key" });
		expect(first).toEqual({ n: 1 });
		expect(second).toEqual({ n: 2 }); // ran twice -- the policy never engaged
	});
});

describe("VehicleIdempotencyPolicy: concurrent duplicate execution happens once", () => {
	it("two concurrent invocations sharing a key/operation/input run the handler exactly once and receive the same result", async () => {
		const operation = keyedOperation("test.concurrent");
		const handler = deferredHandler(operation);
		const registry = registryWithPolicy(new VehicleIdempotencyPolicy(), handler.binding);

		const first = registry.invoke("test.concurrent", 1, { value: "a" }, { idempotencyKey: "req-1" });
		const second = registry.invoke("test.concurrent", 1, { value: "a" }, { idempotencyKey: "req-1" });
		await flush();
		expect(handler.callCount).toBe(1);
		handler.resolve({ result: 42 });

		await expect(first).resolves.toEqual({ result: 42 });
		await expect(second).resolves.toEqual({ result: 42 });
		expect(handler.callCount).toBe(1);
	});

	it("replays a settled success within retentionMs without ever re-invoking the handler", async () => {
		const operation = keyedOperation("test.replay-success");
		const handler = deferredHandler(operation);
		const registry = registryWithPolicy(new VehicleIdempotencyPolicy(), handler.binding);

		const first = registry.invoke("test.replay-success", 1, { value: "a" }, { idempotencyKey: "req-1" });
		handler.resolve({ result: "first" });
		await expect(first).resolves.toEqual({ result: "first" });

		await expect(registry.invoke("test.replay-success", 1, { value: "a" }, { idempotencyKey: "req-1" })).resolves.toEqual({
			result: "first",
		});
		expect(handler.callCount).toBe(1); // never called a second time
	});
});

describe("VehicleIdempotencyPolicy: key conflicts fail closed", () => {
	it("rejects the same key reused for a different operation", async () => {
		const opA = keyedOperation("test.conflict-a");
		const opB = keyedOperation("test.conflict-b");
		const handlerA = deferredHandler(opA);
		const handlerB = deferredHandler(opB);
		const registry = registryWithPolicy(new VehicleIdempotencyPolicy(), handlerA.binding, handlerB.binding);

		const first = registry.invoke("test.conflict-a", 1, {}, { idempotencyKey: "shared-key" });
		await expect(registry.invoke("test.conflict-b", 1, {}, { idempotencyKey: "shared-key" })).rejects.toMatchObject({
			code: "idempotency-conflict",
			category: "conflict",
		});
		handlerA.resolve({});
		await first;
	});

	it("rejects the same key reused for a different input on the same operation", async () => {
		const operation = keyedOperation("test.conflict-input");
		const handler = deferredHandler(operation);
		const registry = registryWithPolicy(new VehicleIdempotencyPolicy(), handler.binding);

		const first = registry.invoke("test.conflict-input", 1, { value: "a" }, { idempotencyKey: "shared-key" });
		await expect(registry.invoke("test.conflict-input", 1, { value: "b" }, { idempotencyKey: "shared-key" })).rejects.toMatchObject({
			code: "idempotency-conflict",
			category: "conflict",
		});
		handler.resolve({});
		await first;
	});

	it("rejects a settled key later reused (within its retention window) for a different input", async () => {
		const operation = keyedOperation("test.conflict-settled");
		const handler = deferredHandler(operation);
		const registry = registryWithPolicy(new VehicleIdempotencyPolicy(), handler.binding);

		const first = registry.invoke("test.conflict-settled", 1, { value: "a" }, { idempotencyKey: "shared-key" });
		handler.resolve({ ok: true });
		await first;

		await expect(
			registry.invoke("test.conflict-settled", 1, { value: "different" }, { idempotencyKey: "shared-key" }),
		).rejects.toMatchObject({ code: "idempotency-conflict" });
	});
});

describe("VehicleIdempotencyPolicy: declared-contract failures are cached, everything else is not", () => {
	it("replays a declared contract failure within retentionMs without re-invoking the handler", async () => {
		const operation = keyedOperation("test.declared-failure", { errors: [{ code: "already-exists", description: "Duplicate." }] });
		const handler = deferredHandler(operation);
		const registry = registryWithPolicy(new VehicleIdempotencyPolicy(), handler.binding);

		const first = registry.invoke("test.declared-failure", 1, {}, { idempotencyKey: "req-1" });
		handler.reject(new VehicleError("already-exists", "already exists", { category: "conflict" }));
		await expect(first).rejects.toMatchObject({ code: "already-exists" });

		await expect(registry.invoke("test.declared-failure", 1, {}, { idempotencyKey: "req-1" })).rejects.toMatchObject({
			code: "already-exists",
			category: "conflict",
		});
		expect(handler.callCount).toBe(1); // replayed, not re-run
	});

	it("never wedges a key on an undeclared/unexpected failure -- the very next call for that key gets a real retry", async () => {
		// Regression scenario for the exact bug class Papyrus task a54f0649 hit in the wild: a local
		// validation failure after a mutation receipt is filed must never permanently wedge that key.
		const operation = keyedOperation("test.undeclared-failure"); // no declared `errors` at all
		const handler = deferredHandler(operation);
		const registry = registryWithPolicy(new VehicleIdempotencyPolicy(), handler.binding);

		const first = registry.invoke("test.undeclared-failure", 1, {}, { idempotencyKey: "req-1" });
		handler.reject(new VehicleError("handler-failed", "boom", { category: "internal" }));
		await expect(first).rejects.toMatchObject({ code: "handler-failed" });

		// Same key, same operation, same input -- must be allowed to actually retry, not replay a wedged failure.
		const second = registry.invoke("test.undeclared-failure", 1, {}, { idempotencyKey: "req-1" });
		await flush();
		expect(handler.callCount).toBe(2); // the handler really ran again
		handler.resolve({ recovered: true });
		await expect(second).resolves.toEqual({ recovered: true });
	});

	it("stops replaying a settled success once past its own retentionMs -- the next call re-executes for real", async () => {
		let now = 0;
		const operation = keyedOperation("test.expired-replay", { retentionMs: 100 });
		const handler = deferredHandler(operation);
		const registry = registryWithPolicy(new VehicleIdempotencyPolicy({ now: () => now }), handler.binding);

		const first = registry.invoke("test.expired-replay", 1, {}, { idempotencyKey: "req-1" });
		handler.resolve({ n: 1 });
		await first;

		now = 1_000; // well past retentionMs
		const second = registry.invoke("test.expired-replay", 1, {}, { idempotencyKey: "req-1" });
		await flush();
		expect(handler.callCount).toBe(2);
		handler.resolve({ n: 2 });
		await expect(second).resolves.toEqual({ n: 2 });
	});
});

describe("VehicleIdempotencyPolicy: bounded retention", () => {
	it("evicts down to maxEntries, oldest settled receipt first, without ever evicting a still-pending request", async () => {
		let now = 0;
		const ops = ["a", "b", "c"].map((suffix) => keyedOperation(`test.cap-${suffix}`));
		const handlers = ops.map((operation) => deferredHandler(operation));
		const policy = new VehicleIdempotencyPolicy({ now: () => now, maxEntries: 2 });
		const registry = registryWithPolicy(policy, ...handlers.map((handler) => handler.binding));

		now = 0;
		const first = registry.invoke("test.cap-a", 1, {}, { idempotencyKey: "key-a" });
		handlers[0]!.resolve({});
		await first;

		now = 10;
		const second = registry.invoke("test.cap-b", 1, {}, { idempotencyKey: "key-b" });
		handlers[1]!.resolve({});
		await second;

		// A third settlement pushes the store to 3 settled entries against a cap of 2 -- oldest (key-a) must go.
		now = 20;
		const third = registry.invoke("test.cap-c", 1, {}, { idempotencyKey: "key-c" });
		handlers[2]!.resolve({});
		await third;

		// key-a's own settled receipt is gone -- reusing it now re-executes rather than conflicting or replaying.
		const retried = registry.invoke("test.cap-a", 1, {}, { idempotencyKey: "key-a" });
		await flush();
		expect(handlers[0]!.callCount).toBe(2);
		handlers[0]!.resolve({ retried: true });
		await expect(retried).resolves.toEqual({ retried: true });
	});

	it("never evicts a still-pending (in-flight) request, even against a maxEntries of 0", async () => {
		const operation = keyedOperation("test.pending-protected");
		const handler = deferredHandler(operation);
		const policy = new VehicleIdempotencyPolicy({ maxEntries: 0 });
		const registry = registryWithPolicy(policy, handler.binding);

		const pending = registry.invoke("test.pending-protected", 1, {}, { idempotencyKey: "req-1" });
		await flush();
		// A concurrent duplicate still joins the same in-flight promise instead of conflicting or re-running.
		const duplicate = registry.invoke("test.pending-protected", 1, {}, { idempotencyKey: "req-1" });
		handler.resolve({ ok: true });
		await expect(pending).resolves.toEqual({ ok: true });
		await expect(duplicate).resolves.toEqual({ ok: true });
		expect(handler.callCount).toBe(1);
	});

	it("evicts down to maxTotalBytes, oldest settled receipt first", async () => {
		let now = 0;
		const ops = ["a", "b"].map((suffix) => keyedOperation(`test.bytes-${suffix}`));
		const handlers = ops.map((operation) => deferredHandler(operation));
		const policy = new VehicleIdempotencyPolicy({ now: () => now, maxTotalBytes: 40 });
		const registry = registryWithPolicy(policy, ...handlers.map((handler) => handler.binding));

		now = 0;
		const first = registry.invoke("test.bytes-a", 1, {}, { idempotencyKey: "key-a" });
		handlers[0]!.resolve({ payload: "x".repeat(30) });
		await first;

		now = 10;
		const second = registry.invoke("test.bytes-b", 1, {}, { idempotencyKey: "key-b" });
		handlers[1]!.resolve({ payload: "y".repeat(30) });
		await second;

		const retried = registry.invoke("test.bytes-a", 1, {}, { idempotencyKey: "key-a" });
		await flush();
		expect(handlers[0]!.callCount).toBe(2); // key-a's receipt was evicted to stay under maxTotalBytes
		handlers[0]!.resolve({ retried: true });
		await expect(retried).resolves.toEqual({ retried: true });
	});
});

describe("VehicleIdempotencyPolicy: persistence and restore", () => {
	it("a settled keyed result is replayed after constructing a new policy over the same persistence adapter", async () => {
		const operation = keyedOperation("test.persist");
		const handler = deferredHandler(operation);
		const persistence = memoryPersistence();
		const policy = new VehicleIdempotencyPolicy({ persistence });
		const registry = registryWithPolicy(policy, handler.binding);

		const first = registry.invoke("test.persist", 1, { value: "a" }, { idempotencyKey: "req-1" });
		handler.resolve({ answer: 42 });
		await first;
		await policy.flushPersistence();

		const restoredHandler = deferredHandler(keyedOperation("test.persist"));
		const restoredPolicy = new VehicleIdempotencyPolicy({ persistence });
		await restoredPolicy.restore();
		const restoredRegistry = registryWithPolicy(restoredPolicy, restoredHandler.binding);

		await expect(restoredRegistry.invoke("test.persist", 1, { value: "a" }, { idempotencyKey: "req-1" })).resolves.toEqual({ answer: 42 });
		expect(restoredHandler.callCount).toBe(0); // replayed from the restored receipt, never re-invoked
	});

	it("a still-pending request has no receipt to restore -- it's simply gone after a restart, never resumed", async () => {
		const operation = keyedOperation("test.persist-pending");
		const handler = deferredHandler(operation);
		const persistence = memoryPersistence();
		const policy = new VehicleIdempotencyPolicy({ persistence });
		const registry = registryWithPolicy(policy, handler.binding);

		// Never resolved -- simulates the daemon dying mid-request. The registry's own real 1000ms
		// deadline WILL eventually reject this (LIMITS.defaultTimeoutMs above) since nothing ever
		// settles the handler; swallow that expected, eventual rejection explicitly so it can't
		// surface ~1s later as an unhandled rejection blamed on whatever unrelated test happens to
		// be running at that moment (confirmed live: intermittently misattributed to a
		// process-supervisor.test.ts test in CI).
		registry.invoke("test.persist-pending", 1, {}, { idempotencyKey: "req-1" }).catch(() => {});
		await policy.flushPersistence();

		const restoredPolicy = new VehicleIdempotencyPolicy({ persistence });
		const result = await restoredPolicy.restore();
		expect(result).toEqual({ restoredCount: 0 });
	});

	it("never persists the original request's raw input -- only its hash", async () => {
		const operation = keyedOperation("test.persist-no-raw-input");
		const handler = deferredHandler(operation);
		const persistence = memoryPersistence();
		const policy = new VehicleIdempotencyPolicy({ persistence });
		const registry = registryWithPolicy(policy, handler.binding);

		const first = registry.invoke("test.persist-no-raw-input", 1, { secret: "do-not-persist-me" }, { idempotencyKey: "req-1" });
		handler.resolve({ ok: true });
		await first;
		await policy.flushPersistence();

		const serialized = JSON.stringify(persistence.saved);
		expect(serialized).not.toContain("do-not-persist-me");
		expect(persistence.saved?.receipts[0]?.inputHash).toBeString();
	});

	it("restore() is a no-op when no persistence adapter is configured", async () => {
		const policy = new VehicleIdempotencyPolicy();
		await expect(policy.restore()).resolves.toEqual({ restoredCount: 0 });
	});

	it("restore() is a no-op when the persistence adapter has nothing saved", async () => {
		const policy = new VehicleIdempotencyPolicy({ persistence: memoryPersistence() });
		await expect(policy.restore()).resolves.toEqual({ restoredCount: 0 });
	});

	it("a persist failure is reported via onPersistError and does not break the request's own execution", async () => {
		const operation = keyedOperation("test.persist-fails");
		const handler = deferredHandler(operation);
		const errors: unknown[] = [];
		const failingPersistence: VehicleIdempotencyPersistenceAdapter = {
			save: async () => {
				throw new Error("disk full");
			},
			load: async () => undefined,
		};
		const policy = new VehicleIdempotencyPolicy({ persistence: failingPersistence, onPersistError: (error) => errors.push(error) });
		const registry = registryWithPolicy(policy, handler.binding);

		const first = registry.invoke("test.persist-fails", 1, {}, { idempotencyKey: "req-1" });
		handler.resolve({ ok: true });
		await expect(first).resolves.toEqual({ ok: true }); // the request itself is unaffected
		await policy.flushPersistence();
		expect(errors.length).toBeGreaterThan(0);
	});
});
