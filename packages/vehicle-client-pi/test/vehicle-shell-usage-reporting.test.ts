import { describe, expect, it, mock } from "bun:test";
import {
	reportableVehiclesByName,
	reportShellToolUsage,
	reportShellToolUsageToAllDiscovered,
	safeReportShellToolUsage,
	type ReportableVehicle,
} from "../src/vehicle-shell/usage-reporting.ts";

function fakeVehicle(name: string, invoke = mock(async () => ({}) as unknown)): ReportableVehicle {
	return { name, client: { invoke: invoke as unknown as ReportableVehicle["client"]["invoke"] } };
}

describe("reportShellToolUsage", () => {
	it("sends event data as input and identity plus permission as invocation context", async () => {
		const invoke = mock(async () => ({}));
		await reportShellToolUsage([fakeVehicle("papyrus", invoke)], "tools_list", "success", 42, "session-1", "/home/x");
		expect(invoke).toHaveBeenCalledTimes(1);
		expect(invoke).toHaveBeenCalledWith(
			"metrics.recordClientEvent",
			1,
			{ toolName: "tools_list", outcome: "success", durationMs: 42 },
			{
				permissions: ["vehicle:metrics:record-client-event"],
				callerSessionId: "session-1",
				callerProjectRoot: "/home/x",
			},
		);
	});

	it("reports to every target given, not just the first", async () => {
		const invokeA = mock(async () => ({}));
		const invokeB = mock(async () => ({}));
		await reportShellToolUsage([fakeVehicle("a", invokeA), fakeVehicle("b", invokeB)], "tools_man", "success", 1, undefined, undefined);
		expect(invokeA).toHaveBeenCalledTimes(1);
		expect(invokeB).toHaveBeenCalledTimes(1);
	});

	it("is a no-op for zero targets -- never throws", async () => {
		await expect(reportShellToolUsage([], "tools_type", "success", 1, undefined, undefined)).resolves.toBeUndefined();
	});

	it("never rejects even when every target's own invoke() throws", async () => {
		const throwing = fakeVehicle(
			"broken",
			mock(async () => {
				throw new Error("daemon unreachable");
			}),
		);
		await expect(reportShellToolUsage([throwing], "tools_list", "failure", 1, undefined, undefined)).resolves.toBeUndefined();
	});
});

describe("reportableVehiclesByName", () => {
	it("keeps only vehicles whose name is in the given set", () => {
		const vehicles = [fakeVehicle("a"), fakeVehicle("b"), fakeVehicle("c")];
		const filtered = reportableVehiclesByName(vehicles, new Set(["a", "c"]));
		expect(filtered.map((v) => v.name)).toEqual(["a", "c"]);
	});

	it("returns an empty array when nothing matches", () => {
		expect(reportableVehiclesByName([fakeVehicle("a")], new Set(["z"]))).toEqual([]);
	});
});

describe("safeReportShellToolUsage", () => {
	it("calls the target's invoke() synchronously (before any await), so a caller can assert immediately without an artificial wait", () => {
		const invoke = mock(async () => ({}));
		safeReportShellToolUsage([fakeVehicle("papyrus", invoke)], "tools_man", "success", 5, "s1", "/x");
		expect(invoke).toHaveBeenCalledTimes(1);
	});

	it("never throws even when invoke() itself throws synchronously", () => {
		const throwing = fakeVehicle("broken", mock(() => {
			throw new Error("boom");
		}) as never);
		expect(() => safeReportShellToolUsage([throwing], "tools_list", "success", 0, undefined, undefined)).not.toThrow();
	});
});

describe("reportShellToolUsageToAllDiscovered", () => {
	it("calls discover(), then reports to every vehicle it returns", async () => {
		const invoke = mock(async () => ({}));
		const discover = mock(async () => [fakeVehicle("papyrus", invoke), fakeVehicle("tickets", invoke)]);
		reportShellToolUsageToAllDiscovered(discover, "tools_list", "success", 3, "s1", "/x");
		await Promise.resolve(); // let discover()'s own resolution + the .then() callback run
		await Promise.resolve();
		expect(discover).toHaveBeenCalledTimes(1);
		expect(invoke).toHaveBeenCalledTimes(2);
	});

	it("never throws (and never affects the caller) when discover() itself rejects", async () => {
		const discover = mock(async () => {
			throw new Error("discovery failed");
		});
		expect(() => reportShellToolUsageToAllDiscovered(discover, "tools_list", "success", 0, undefined, undefined)).not.toThrow();
		await Promise.resolve();
		await Promise.resolve();
	});
});
