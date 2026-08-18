import { describe, expect, it } from "bun:test";
import type { VehicleOperationDescriptor } from "@danypops/vehicle-core";
import { createMetricsAwareToolName, defaultToolName } from "../src/vehicle-pi-primitives.js";

function descriptor(name: string, version = 1): VehicleOperationDescriptor {
	return { name, version } as VehicleOperationDescriptor;
}

describe("createMetricsAwareToolName", () => {
	it("vehicle-prefixes the shared metrics.query/metrics.recordClientEvent pair", () => {
		const toolName = createMetricsAwareToolName("papyrus");
		expect(toolName(descriptor("metrics.query"), false)).toBe("papyrus_metrics_query");
		expect(toolName(descriptor("metrics.recordClientEvent"), false)).toBe("papyrus_metrics_recordclientevent");
	});

	it("two different vehicles never collide on the shared metrics operations", () => {
		const papyrusName = createMetricsAwareToolName("papyrus")(descriptor("metrics.query"), false);
		const ticketsName = createMetricsAwareToolName("tickets")(descriptor("metrics.query"), false);
		expect(papyrusName).not.toBe(ticketsName);
	});

	it("keeps defaultToolName's own bare naming for every ordinary, non-metrics operation", () => {
		const toolName = createMetricsAwareToolName("papyrus");
		expect(toolName(descriptor("tasks.start"), false)).toBe(defaultToolName(descriptor("tasks.start"), false));
		expect(toolName(descriptor("tasks.start"), false)).toBe("tasks_start");
	});

	it("honors a custom metricsOperationPrefix matching a non-default registerVehicleMetricsOperations() call", () => {
		const toolName = createMetricsAwareToolName("jittor", "usage-metrics");
		expect(toolName(descriptor("usage-metrics.query"), false)).toBe("jittor_usage_metrics_query");
		// A plain "metrics.query" is no longer the recognized prefix, so it stays bare.
		expect(toolName(descriptor("metrics.query"), false)).toBe("metrics_query");
	});

	it("still respects the versioned suffix for both branches", () => {
		const toolName = createMetricsAwareToolName("tickets");
		expect(toolName(descriptor("metrics.query", 2), true)).toBe("tickets_metrics_query_v2");
		expect(toolName(descriptor("tasks.start", 3), true)).toBe("tasks_start_v3");
	});
});
