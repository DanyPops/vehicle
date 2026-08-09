import { afterEach, describe, expect, it } from "bun:test";
import diagnosticsChannel from "node:diagnostics_channel";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	__classificationFailureChannelForTests,
	CLASSIFICATION_FAILURE_CHANNEL_NAME,
	reportClassificationFailure,
} from "../src/client-diagnostics.ts";

describe("reportClassificationFailure", () => {
	const directory = mkdtempSync(join(tmpdir(), "vehicle-client-diag-"));
	const path = join(directory, "client-diag.log");

	afterEach(() => {
		delete process.env.VEHICLE_CLIENT_DIAG;
		delete process.env.VEHICLE_CLIENT_DIAG_PATH;
		rmSync(directory, { recursive: true, force: true });
	});

	it("resolves the documented channel name via the standard diagnostics_channel API", () => {
		expect(__classificationFailureChannelForTests()).toBe(diagnosticsChannel.channel(CLASSIFICATION_FAILURE_CHANNEL_NAME));
	});

	it("publishes a structured event to the diagnostics_channel unconditionally, with no env var required", () => {
		const events: unknown[] = [];
		const channel = diagnosticsChannel.channel(CLASSIFICATION_FAILURE_CHANNEL_NAME);
		const subscriber = (event: unknown) => events.push(event);
		channel.subscribe(subscriber);
		try {
			reportClassificationFailure(new TypeError("original"), new TypeError("Right-hand side of 'instanceof' is not an object"));
		} finally {
			channel.unsubscribe(subscriber);
		}
		expect(events).toEqual([
			{
				ts: expect.any(String),
				originalErrorKind: "TypeError",
				internalFailureKind: "TypeError",
				internalFailureMessage: "Right-hand side of 'instanceof' is not an object",
			},
		]);
	});

	it("never leaks the original error's own message onto the channel event, only its constructor name", () => {
		const events: unknown[] = [];
		const channel = diagnosticsChannel.channel(CLASSIFICATION_FAILURE_CHANNEL_NAME);
		const subscriber = (event: unknown) => events.push(event);
		channel.subscribe(subscriber);
		try {
			reportClassificationFailure(new Error("credential=super-secret-token"), new Error("boom"));
		} finally {
			channel.unsubscribe(subscriber);
		}
		const serialized = JSON.stringify(events);
		expect(serialized).not.toContain("super-secret-token");
	});

	it("is a file-log no-op when VEHICLE_CLIENT_DIAG isn't set to 1", () => {
		process.env.VEHICLE_CLIENT_DIAG_PATH = path;
		reportClassificationFailure(new Error("x"), new Error("y"));
		expect(existsSync(path)).toBe(false);
	});

	it("appends a JSONL entry once VEHICLE_CLIENT_DIAG=1", () => {
		process.env.VEHICLE_CLIENT_DIAG = "1";
		process.env.VEHICLE_CLIENT_DIAG_PATH = path;
		reportClassificationFailure(new TypeError("original"), new RangeError("internal"));
		const lines = readFileSync(path, "utf8").trim().split("\n");
		expect(lines).toHaveLength(1);
		const entry = JSON.parse(lines[0]!);
		expect(entry).toMatchObject({
			originalErrorKind: "TypeError",
			internalFailureKind: "RangeError",
			internalFailureMessage: "internal",
		});
		expect(typeof entry.ts).toBe("string");
	});

	it("never throws even when the configured file path is unwritable", () => {
		process.env.VEHICLE_CLIENT_DIAG = "1";
		process.env.VEHICLE_CLIENT_DIAG_PATH = "/nonexistent-root-owned-directory/client-diag.log";
		expect(() => reportClassificationFailure(new Error("x"), new Error("y"))).not.toThrow();
	});

	// A subscriber's own thrown exception is deliberately NOT this module's concern: per
	// node:diagnostics_channel's own documented contract, channel.publish() isolates a subscriber
	// throw to process.on('uncaughtException') so a broken subscriber can never crash the
	// publisher -- see reportClassificationFailure's own doc comment. Not re-tested here since
	// that guarantee belongs to the Node/Bun runtime, not to this module.

	it("handles a non-Error thrown as the internal failure without throwing", () => {
		process.env.VEHICLE_CLIENT_DIAG = "1";
		process.env.VEHICLE_CLIENT_DIAG_PATH = path;
		expect(() => reportClassificationFailure("not an error", { weird: true })).not.toThrow();
		const entry = JSON.parse(readFileSync(path, "utf8").trim().split("\n")[0]!);
		expect(entry.originalErrorKind).toBe("string");
		expect(entry.internalFailureKind).toBe("object");
	});
});
