import type { VehicleClient } from "../client/client.js";
import { VehicleError } from "../errors/error.js";
import { snapshotVehicleJson, VehicleJsonByteLimitError } from "../schemas/bounded-json.js";
import type { VehicleSchemaCodec } from "../schemas/codec.js";
import { strictVehicleJsonSchema } from "../schemas/strict-profile.js";
import type { VehicleInvocationOptions } from "./context.js";
import type { VehicleOperation, VehicleOperationDescriptor } from "./operation.js";

export interface VehicleOperationProjection<Input, Output> {
	readonly descriptor: VehicleOperationDescriptor;
	/** JSON help envelope, bounded to 256 KiB, carrying the operation's full descriptor. */
	readonly help: string;
	/** Parses --input JSON and optional --json; authentication and invocation options stay out of argv. */
	parseArgs(args: readonly string[]): Input;
	/** Calls the supplied authenticated client once, preserving its error and invocation context. */
	invoke(client: VehicleClient, input: Input, options?: VehicleInvocationOptions): Promise<Output>;
}

function validate<Value>(
	codec: VehicleSchemaCodec<Value>,
	value: unknown,
	maxBytes: number,
	code: "invalid-input" | "invalid-output",
): Value {
	let snapshot: unknown;
	try {
		snapshot = snapshotVehicleJson(value, maxBytes);
	} catch (error) {
		if (error instanceof VehicleJsonByteLimitError)
			throw new VehicleError(
				code === "invalid-input" ? "request-too-large" : "response-too-large",
				"Operation value exceeds its byte ceiling.",
				{ category: "capacity" },
			);
		throw new VehicleError(code, "Operation value exceeds its JSON contract.", {
			category: code === "invalid-input" ? "validation" : "internal",
		});
	}
	const result = codec.safeParse(snapshot);
	if (!result.success)
		throw new VehicleError(code, "Operation value violates its schema.", {
			category: code === "invalid-input" ? "validation" : "internal",
		});
	return result.value;
}

/** Projects a bounded operation into reusable CLI parsing/help and typed client dispatch. */
export function projectVehicleOperation<Input, Output>(
	operation: VehicleOperation<Input, Output>,
): VehicleOperationProjection<Input, Output> {
	for (const bound of [operation.descriptor.limits.maxRequestBytes, operation.descriptor.limits.maxResponseBytes]) {
		if (!Number.isSafeInteger(bound) || bound < 1 || bound > 1_048_576)
			throw new Error("Projection byte ceiling must be between 1 byte and 1 MiB");
	}
	strictVehicleJsonSchema(operation.descriptor.inputSchema);
	strictVehicleJsonSchema(operation.descriptor.outputSchema);
	const descriptor = snapshotVehicleJson(operation.descriptor, 262_144) as unknown as VehicleOperationDescriptor;
	const help = JSON.stringify({ usage: `${descriptor.name} --input '<JSON>' [--json]`, operation: descriptor });
	if (new TextEncoder().encode(help).byteLength > 262_144) throw new Error("Operation help exceeds 256 KiB");
	return Object.freeze({
		descriptor: operation.descriptor,
		help,
		parseArgs(args: readonly string[]): Input {
			const invalid = () =>
				new VehicleError("invalid-input", "Expected --input JSON and optional --json; use operation help for its schema.", {
					category: "validation",
				});
			if (args.length < 2 || args.length > 3 || args.some((arg) => typeof arg !== "string" || arg.length > 1_048_576)) throw invalid();
			const tokens = args.filter((arg) => arg !== "--json");
			if (tokens.length !== 2 || tokens[0] !== "--input" || args.filter((arg) => arg === "--json").length > 1) throw invalid();
			const text = tokens[1]!;
			if (new TextEncoder().encode(text).byteLength > 1_048_576)
				throw new VehicleError("request-too-large", "CLI JSON input exceeds 1 MiB.", { category: "capacity" });
			let input: unknown;
			try {
				input = JSON.parse(text);
			} catch {
				throw invalid();
			}
			return validate(operation.input, input, descriptor.limits.maxRequestBytes, "invalid-input");
		},
		async invoke(client: VehicleClient, input: Input, options?: VehicleInvocationOptions): Promise<Output> {
			const parsed = validate(operation.input, input, descriptor.limits.maxRequestBytes, "invalid-input");
			const output = await client.invoke(descriptor.name, descriptor.version, parsed, options);
			return validate(operation.output, output, descriptor.limits.maxResponseBytes, "invalid-output");
		},
	});
}
