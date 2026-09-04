/** Bounds metric schemas, retained aggregate series, histogram shape, and query output. */
export interface RuntimeMetricBounds {
	readonly maxDefinitions: number;
	readonly maxDimensionsPerMetric: number;
	readonly maxValuesPerDimension: number;
	readonly maxHistogramBuckets: number;
	readonly maxSeries: number;
	readonly maxQueryResults: number;
}

interface RuntimeMetricDefinitionBase {
	readonly name: string;
	readonly dimensions: Readonly<Record<string, readonly string[]>>;
}

/** Declares one gauge and its complete finite dimension vocabulary. */
export interface RuntimeGaugeDefinition extends RuntimeMetricDefinitionBase {
	readonly kind: "gauge";
}

/** Declares one cumulative histogram, finite dimensions, and finite upper bounds. */
export interface RuntimeHistogramDefinition extends RuntimeMetricDefinitionBase {
	readonly kind: "histogram";
	readonly buckets: readonly number[];
}

/** Describes one schema-controlled runtime metric. */
export type RuntimeMetricDefinition = RuntimeGaugeDefinition | RuntimeHistogramDefinition;

/** Reports the latest value retained for one gauge series. */
export interface RuntimeGaugeSeries {
	readonly name: string;
	readonly kind: "gauge";
	readonly dimensions: Readonly<Record<string, string>>;
	readonly value: number;
}

/** Reports bounded cumulative aggregates for one histogram series. */
export interface RuntimeHistogramSeries {
	readonly name: string;
	readonly kind: "histogram";
	readonly dimensions: Readonly<Record<string, string>>;
	readonly count: number;
	readonly sum: number;
	readonly buckets: readonly { readonly upperBound: number; readonly count: number }[];
}

/** Represents one gauge or histogram series in a bounded query result. */
export type RuntimeMetricSeries = RuntimeGaugeSeries | RuntimeHistogramSeries;

/** Selects declared metric names under an explicit result bound. */
export interface RuntimeMetricQuery {
	readonly names?: readonly string[];
	readonly maxResults: number;
}

/** Returns deterministic metric series and reports result-bound truncation. */
export interface RuntimeMetricQueryResult {
	readonly series: readonly RuntimeMetricSeries[];
	readonly truncated: boolean;
}

/** Distinguishes a recorded aggregate from bounded series-capacity refusal. */
export type RuntimeMetricRecordOutcome = { readonly recorded: true } | { readonly recorded: false; readonly reason: "series-capacity" };

/** Aggregates schema-controlled gauges and histograms in bounded process memory. */
export interface BoundedRuntimeMetrics {
	setGauge(name: string, value: number, dimensions: Readonly<Record<string, string>>): RuntimeMetricRecordOutcome;
	observe(name: string, value: number, dimensions: Readonly<Record<string, string>>): RuntimeMetricRecordOutcome;
	query(query: RuntimeMetricQuery): RuntimeMetricQueryResult;
	close(): void;
}

interface NormalizedDefinition {
	readonly definition: RuntimeMetricDefinition;
	readonly dimensionNames: readonly string[];
	readonly allowedDimensions: ReadonlyMap<string, ReadonlySet<string>>;
}

interface MutableGaugeSeries {
	readonly name: string;
	readonly kind: "gauge";
	readonly dimensions: Readonly<Record<string, string>>;
	value: number;
}

interface MutableHistogramSeries {
	readonly name: string;
	readonly kind: "histogram";
	readonly dimensions: Readonly<Record<string, string>>;
	count: number;
	sum: number;
	readonly bucketCounts: number[];
	readonly upperBounds: readonly number[];
}

type MutableSeries = MutableGaugeSeries | MutableHistogramSeries;

const METRIC_NAME = /^[a-z][a-z0-9_.-]*$/;
const DIMENSION_NAME = /^[a-z][a-zA-Z0-9_]*$/;

function assertBounds(bounds: RuntimeMetricBounds): void {
	if (!Object.values(bounds).every((value) => Number.isSafeInteger(value) && value > 0)) {
		throw new TypeError("runtime metric bounds must be positive safe integers");
	}
}

function normalizeDefinitions(
	definitions: readonly RuntimeMetricDefinition[],
	bounds: RuntimeMetricBounds,
): ReadonlyMap<string, NormalizedDefinition> {
	if (definitions.length > bounds.maxDefinitions) throw new TypeError(`runtime metric definitions exceed ${bounds.maxDefinitions}`);
	const normalized = new Map<string, NormalizedDefinition>();
	for (const definition of definitions) {
		if (!METRIC_NAME.test(definition.name)) throw new TypeError(`invalid runtime metric name: ${definition.name}`);
		if (normalized.has(definition.name)) throw new TypeError(`duplicate runtime metric name: ${definition.name}`);
		const dimensionNames = Object.keys(definition.dimensions).sort();
		if (dimensionNames.length > bounds.maxDimensionsPerMetric)
			throw new TypeError(`runtime metric ${definition.name} has too many dimensions`);
		const allowedDimensions = new Map<string, ReadonlySet<string>>();
		for (const dimensionName of dimensionNames) {
			if (!DIMENSION_NAME.test(dimensionName)) throw new TypeError(`invalid runtime metric dimension: ${dimensionName}`);
			const values = definition.dimensions[dimensionName] ?? [];
			if (values.length < 1 || values.length > bounds.maxValuesPerDimension) {
				throw new TypeError(`runtime metric dimension ${dimensionName} must declare 1..${bounds.maxValuesPerDimension} values`);
			}
			const unique = new Set(values);
			if (unique.size !== values.length || values.some((value) => value.length === 0))
				throw new TypeError(`runtime metric dimension ${dimensionName} values must be unique and non-empty`);
			allowedDimensions.set(dimensionName, unique);
		}
		if (definition.kind === "histogram") {
			if (definition.buckets.length < 1) throw new TypeError(`runtime histogram ${definition.name} requires at least one bucket`);
			if (definition.buckets.length > bounds.maxHistogramBuckets)
				throw new TypeError(`runtime histogram ${definition.name} has too many buckets`);
			for (let index = 0; index < definition.buckets.length; index += 1) {
				const upperBound = definition.buckets[index];
				if (upperBound === undefined || !Number.isFinite(upperBound))
					throw new TypeError(`runtime histogram ${definition.name} buckets must be finite`);
				if (index > 0 && upperBound <= (definition.buckets[index - 1] ?? upperBound)) {
					throw new TypeError(`runtime histogram ${definition.name} buckets must be strictly increasing`);
				}
			}
		}
		normalized.set(definition.name, { definition, dimensionNames, allowedDimensions });
	}
	return normalized;
}

function dimensionsFor(
	definition: NormalizedDefinition,
	supplied: Readonly<Record<string, string>>,
): { readonly key: string; readonly value: Readonly<Record<string, string>> } {
	const suppliedNames = Object.keys(supplied).sort();
	const missing = definition.dimensionNames.filter((name) => supplied[name] === undefined);
	if (missing.length > 0) throw new TypeError(`missing dimensions for ${definition.definition.name}: ${missing.join(", ")}`);
	const unexpected = suppliedNames.filter((name) => !definition.allowedDimensions.has(name));
	if (unexpected.length > 0) throw new TypeError(`unexpected dimensions for ${definition.definition.name}: ${unexpected.join(", ")}`);
	const value: Record<string, string> = {};
	const keyValues: string[] = [];
	for (const name of definition.dimensionNames) {
		const dimensionValue = supplied[name] ?? "";
		if (!definition.allowedDimensions.get(name)?.has(dimensionValue)) {
			throw new TypeError(`unsupported dimension value for ${definition.definition.name}.${name}: ${dimensionValue}`);
		}
		value[name] = dimensionValue;
		keyValues.push(dimensionValue);
	}
	return { key: JSON.stringify([definition.definition.name, ...keyValues]), value };
}

function increment(value: number): number {
	return value < Number.MAX_SAFE_INTEGER ? value + 1 : Number.MAX_SAFE_INTEGER;
}

/** Creates an allocation-bounded aggregate store whose metric names and dimension values are fixed by the supplied schema. */
export function createBoundedRuntimeMetrics(
	definitions: readonly RuntimeMetricDefinition[],
	bounds: RuntimeMetricBounds,
): BoundedRuntimeMetrics {
	assertBounds(bounds);
	const schema = normalizeDefinitions(definitions, bounds);
	const series = new Map<string, MutableSeries>();
	let closed = false;

	const assertOpen = () => {
		if (closed) throw new Error("runtime metrics store is closed");
	};
	const definitionFor = (name: string): NormalizedDefinition => {
		const definition = schema.get(name);
		if (!definition) throw new TypeError(`unknown metric: ${name}`);
		return definition;
	};
	const admit = (key: string, create: () => MutableSeries): MutableSeries | undefined => {
		const existing = series.get(key);
		if (existing) return existing;
		if (series.size >= bounds.maxSeries) return undefined;
		const created = create();
		series.set(key, created);
		return created;
	};

	return {
		setGauge(name, value, suppliedDimensions) {
			assertOpen();
			if (!Number.isFinite(value)) throw new TypeError("gauge value must be finite");
			const normalized = definitionFor(name);
			if (normalized.definition.kind !== "gauge") throw new TypeError(`${name} is not a gauge`);
			const dimensions = dimensionsFor(normalized, suppliedDimensions);
			const target = admit(dimensions.key, () => ({ name, kind: "gauge", dimensions: dimensions.value, value }));
			if (!target) return { recorded: false, reason: "series-capacity" };
			if (target.kind !== "gauge") throw new Error(`runtime metric series kind mismatch for ${name}`);
			target.value = value;
			return { recorded: true };
		},
		observe(name, value, suppliedDimensions) {
			assertOpen();
			if (!Number.isFinite(value)) throw new TypeError("histogram observation must be finite");
			const normalized = definitionFor(name);
			if (normalized.definition.kind !== "histogram") throw new TypeError(`${name} is not a histogram`);
			const dimensions = dimensionsFor(normalized, suppliedDimensions);
			const target = admit(dimensions.key, () => ({
				name,
				kind: "histogram",
				dimensions: dimensions.value,
				count: 0,
				sum: 0,
				bucketCounts: normalized.definition.kind === "histogram" ? normalized.definition.buckets.map(() => 0) : [],
				upperBounds: normalized.definition.kind === "histogram" ? normalized.definition.buckets : [],
			}));
			if (!target) return { recorded: false, reason: "series-capacity" };
			if (target.kind !== "histogram") throw new Error(`runtime metric series kind mismatch for ${name}`);
			target.count = increment(target.count);
			const nextSum = target.sum + value;
			target.sum = Number.isFinite(nextSum) ? nextSum : Math.sign(nextSum) * Number.MAX_VALUE;
			for (let index = 0; index < target.upperBounds.length; index += 1) {
				if (value <= (target.upperBounds[index] ?? Number.NEGATIVE_INFINITY))
					target.bucketCounts[index] = increment(target.bucketCounts[index] ?? 0);
			}
			return { recorded: true };
		},
		query(query) {
			assertOpen();
			if (!Number.isSafeInteger(query.maxResults) || query.maxResults < 1 || query.maxResults > bounds.maxQueryResults) {
				throw new TypeError(`maxResults must be a positive safe integer no greater than ${bounds.maxQueryResults}`);
			}
			const names = query.names ? new Set(query.names.map((name) => definitionFor(name).definition.name)) : undefined;
			const selected = [...series.values()]
				.filter((entry) => !names || names.has(entry.name))
				.sort(
					(left, right) =>
						left.name.localeCompare(right.name) || JSON.stringify(left.dimensions).localeCompare(JSON.stringify(right.dimensions)),
				);
			const truncated = selected.length > query.maxResults;
			const result = selected.slice(0, query.maxResults).map((entry): RuntimeMetricSeries => {
				if (entry.kind === "gauge") return { name: entry.name, kind: entry.kind, dimensions: entry.dimensions, value: entry.value };
				return {
					name: entry.name,
					kind: entry.kind,
					dimensions: entry.dimensions,
					count: entry.count,
					sum: entry.sum,
					buckets: entry.upperBounds.map((upperBound, index) => ({ upperBound, count: entry.bucketCounts[index] ?? 0 })),
				};
			});
			return { series: result, truncated };
		},
		close() {
			series.clear();
			closed = true;
		},
	};
}
