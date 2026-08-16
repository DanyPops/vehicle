import { describe, expect, it } from "bun:test";
import { VehicleJobSteerChannel } from "../../src/jobs/steer.ts";

describe("VehicleJobSteerChannel", () => {
	it("delivers a push directly to a waiting reader without buffering it", async () => {
		const channel = new VehicleJobSteerChannel(1);
		const iterator = channel[Symbol.asyncIterator]();
		const pending = iterator.next();
		expect(channel.push("hello")).toEqual({ accepted: true });
		await expect(pending).resolves.toEqual({ value: "hello", done: false });
	});

	it("buffers a push made before any reader is iterating, up to maxQueueSize", async () => {
		const channel = new VehicleJobSteerChannel(2);
		expect(channel.push("a")).toEqual({ accepted: true });
		expect(channel.push("b")).toEqual({ accepted: true });
		expect(channel.push("c")).toEqual({ accepted: false, dropReason: "queue-full" });

		const iterator = channel[Symbol.asyncIterator]();
		await expect(iterator.next()).resolves.toEqual({ value: "a", done: false });
		await expect(iterator.next()).resolves.toEqual({ value: "b", done: false });
	});

	it("close() ends every pending and future iteration, and refuses further pushes", async () => {
		const channel = new VehicleJobSteerChannel(4);
		const iterator = channel[Symbol.asyncIterator]();
		const pending = iterator.next();
		channel.close();
		await expect(pending).resolves.toEqual({ value: undefined, done: true });
		await expect(iterator.next()).resolves.toEqual({ value: undefined, done: true });
		expect(channel.push("too late")).toEqual({ accepted: false, dropReason: "channel-closed" });
	});

	it("close() is idempotent", () => {
		const channel = new VehicleJobSteerChannel();
		channel.close();
		expect(() => channel.close()).not.toThrow();
	});

	it("a for-await consumer sees every pushed value in order, then ends cleanly on close()", async () => {
		const channel = new VehicleJobSteerChannel();
		const seen: unknown[] = [];
		const consumer = (async () => {
			for await (const value of channel) seen.push(value);
		})();
		channel.push(1);
		channel.push(2);
		await Promise.resolve();
		channel.close();
		await consumer;
		expect(seen).toEqual([1, 2]);
	});
});
