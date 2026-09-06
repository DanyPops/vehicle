import { createHash } from "node:crypto";
import type { VehicleClient, VehicleManifest } from "@danypops/vehicle-core";
import { estimateToolWeightTokens, type ToolWeightInput } from "../../src/vehicle-shell/tool-weight.ts";

/** Builds two fixed synthetic catalogs with shared operation names for identity checks. */
export function efficiencyCatalog(): VehicleManifest[] {
	return ["alpha", "beta"].map((name) => ({
		name,
		version: "1.0.0",
		description: "Synthetic exposure fixture.",
		operations: Array.from({ length: 12 }, (_, index) => ({
			name: `${index % 2 === 0 ? "records" : "artifacts"}.read${String(index).padStart(2, "0")}`,
			version: 1,
			description: "Reads a bounded café record with source evidence.",
			inputSchema: {
				type: "object",
				properties: { id: { type: "string", maxLength: 64 }, limit: { type: "integer", minimum: 1, maximum: 100 } },
				required: ["id"],
				additionalProperties: false,
			},
			outputSchema: { type: "object", properties: { found: { type: "boolean" } }, required: ["found"], additionalProperties: false },
			permissions: [],
			effect: "read" as const,
			idempotency: { mode: "safe" as const },
			streaming: false,
			longRunning: false,
			limits: { defaultTimeoutMs: 1_000, maxTimeoutMs: 5_000, maxRequestBytes: 1_024, maxResponseBytes: 4_096 },
			errors: [],
			available: true,
		})),
	}));
}

/** Counts manifest work and rejects operation dispatch in discovery-only workloads. */
export class SyntheticCatalogClient implements VehicleClient {
	manifestCalls = 0;
	invocationCalls = 0;
	telemetryCalls = 0;
	constructor(public value: VehicleManifest) {}
	manifest(): Promise<VehicleManifest> {
		this.manifestCalls++;
		return Promise.resolve(this.value);
	}
	invoke<Output = unknown>(name: string): Promise<Output> {
		if (name === "metrics.recordClientEvent") this.telemetryCalls++;
		else this.invocationCalls++;
		return Promise.reject(new Error("discovery fixture cannot dispatch operations"));
	}
	close(): Promise<void> {
		return Promise.resolve();
	}
}

/** Measures projected definitions and content JSON, rather than claiming provider wire usage. */
export function measureExposure(
	tools: readonly ToolWeightInput[],
	content: readonly { type: string; text: string }[],
	names: readonly string[],
) {
	if (tools.length > 128 || content.length > 128 || names.length > 128 || names.some((name) => name.length > 256)) {
		throw new RangeError("fixture capacity exceeded");
	}
	const schemaJson = JSON.stringify(tools.map(({ name, description, parameters }) => ({ name, description, parameters })));
	const contentJson = JSON.stringify(content);
	const schemaUtf8Bytes = Buffer.byteLength(schemaJson, "utf8");
	const resultUtf8Bytes = Buffer.byteLength(contentJson, "utf8");
	if (schemaUtf8Bytes > 131_072 || resultUtf8Bytes > 131_072) throw new RangeError("fixture bytes exceeded");
	return {
		schemaUtf8Bytes,
		resultUtf8Bytes,
		estimatedSchemaTokens: tools.reduce((total, tool) => total + estimateToolWeightTokens(tool), 0),
		estimatedResultTokens: Math.ceil(contentJson.length / 4),
		operationCount: names.length,
		operationDigest: createHash("sha256").update(JSON.stringify(names)).digest("hex"),
		providerUsage: null,
	};
}
