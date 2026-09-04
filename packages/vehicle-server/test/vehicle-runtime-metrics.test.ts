import { describe, expect, it } from "bun:test";
import { createBoundedRuntimeMetrics } from "../src/vehicle-runtime-metrics.ts";

const bounds = {
	maxDefinitions: 4,
	maxDimensionsPerMetric: 2,
	maxValuesPerDimension: 4,
	maxHistogramBuckets: 6,
	maxSeries: 4,
	maxQueryResults: 4,
} as const;

function metrics() {
	return createBoundedRuntimeMetrics(
		[
			{ name: "runtime.rss_bytes", kind: "gauge", dimensions: {} },
			{
				name: "operation.duration_ms",
				kind: "histogram",
				dimensions: { operation: ["read", "write"], outcome: ["success", "failure"] },
				buckets: [1, 10, 100],
			},
		],
		bounds,
	);
}

describe("createBoundedRuntimeMetrics", () => {
	it("updates a gauge in one bounded series", () => {
		const store = metrics();
		expect(store.setGauge("runtime.rss_bytes", 100, {})).toEqual({ recorded: true });
		expect(store.setGauge("runtime.rss_bytes", 120, {})).toEqual({ recorded: true });
		expect(store.query({ maxResults: 4 })).toEqual({
			series: [{ name: "runtime.rss_bytes", kind: "gauge", dimensions: {}, value: 120 }],
			truncated: false,
		});
	});

	it("aggregates histogram count, sum, and cumulative finite buckets", () => {
		const store = metrics();
		store.observe("operation.duration_ms", 0.5, { operation: "read", outcome: "success" });
		store.observe("operation.duration_ms", 5, { operation: "read", outcome: "success" });
		store.observe("operation.duration_ms", 500, { operation: "read", outcome: "success" });
		expect(store.query({ names: ["operation.duration_ms"], maxResults: 4 }).series).toEqual([
			{
				name: "operation.duration_ms",
				kind: "histogram",
				dimensions: { operation: "read", outcome: "success" },
				count: 3,
				sum: 505.5,
				buckets: [
					{ upperBound: 1, count: 1 },
					{ upperBound: 10, count: 2 },
					{ upperBound: 100, count: 2 },
				],
			},
		]);
	});

	it("rejects metric names and dimension values outside the declared finite schema", () => {
		const store = metrics();
		expect(() => store.setGauge("workspace.path", 1, {})).toThrow("unknown metric");
		expect(() => store.observe("operation.duration_ms", 1, { operation: "/secret/path", outcome: "success" })).toThrow(
			"unsupported dimension value",
		);
		expect(() => store.observe("operation.duration_ms", 1, { operation: "read", outcome: "success", query: "caller text" })).toThrow(
			"unexpected dimensions",
		);
		expect(() => store.observe("operation.duration_ms", 1, { operation: "read" })).toThrow("missing dimensions");
	});

	it("refuses a new series at capacity while existing series remain writable", () => {
		const store = createBoundedRuntimeMetrics(
			[{ name: "requests", kind: "histogram", dimensions: { operation: ["a", "b"] }, buckets: [1] }],
			{ ...bounds, maxSeries: 1 },
		);
		expect(store.observe("requests", 1, { operation: "a" })).toEqual({ recorded: true });
		expect(store.observe("requests", 1, { operation: "b" })).toEqual({ recorded: false, reason: "series-capacity" });
		expect(store.observe("requests", 2, { operation: "a" })).toEqual({ recorded: true });
		expect(store.query({ maxResults: 4 }).series[0]).toMatchObject({ count: 2, sum: 3 });
	});

	it("bounds deterministic query output and reports truncation", () => {
		const store = metrics();
		store.setGauge("runtime.rss_bytes", 10, {});
		store.observe("operation.duration_ms", 1, { operation: "write", outcome: "success" });
		expect(store.query({ maxResults: 1 })).toMatchObject({ truncated: true, series: [{ name: "operation.duration_ms" }] });
		expect(() => store.query({ maxResults: 5 })).toThrow("maxResults");
	});

	it("validates definition and retention bounds before accepting observations", () => {
		expect(() => createBoundedRuntimeMetrics([{ name: "bad", kind: "histogram", dimensions: {}, buckets: [10, 1] }], bounds)).toThrow(
			"strictly increasing",
		);
		expect(() => createBoundedRuntimeMetrics([{ name: "bad", kind: "histogram", dimensions: {}, buckets: [] }], bounds)).toThrow(
			"at least one bucket",
		);
		expect(() =>
			createBoundedRuntimeMetrics([{ name: "a", kind: "gauge", dimensions: {} }], { ...bounds, maxSeries: Number.POSITIVE_INFINITY }),
		).toThrow("positive safe integers");
	});

	it("releases retained series on close and rejects later access", () => {
		const store = metrics();
		store.setGauge("runtime.rss_bytes", 1, {});
		store.close();
		expect(() => store.query({ maxResults: 4 })).toThrow("closed");
		expect(() => store.setGauge("runtime.rss_bytes", 2, {})).toThrow("closed");
	});
});
