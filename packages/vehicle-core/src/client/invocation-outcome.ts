import { isVehicleError, type VehicleFailure } from "../errors/error.js";
import type { VehicleInvocationOptions } from "../operations/context.js";
import type { VehicleClient } from "./client.js";

export type VehicleInvocationOutcome<Output> =
	| { readonly ok: true; readonly value: Output }
	| { readonly ok: false; readonly kind: "vehicle-failure"; readonly failure: VehicleFailure }
	| { readonly ok: false; readonly kind: "cancelled"; readonly message: string; readonly operationId?: string }
	| {
			readonly ok: false;
			readonly kind: "transport-failure";
			readonly message: string;
			readonly retryable: true;
			readonly operationId?: string;
	  }
	| { readonly ok: false; readonly kind: "unexpected-failure"; readonly message: string; readonly operationId?: string };

/** Invokes one Vehicle operation while representing expected and boundary failures as typed values. */
export async function invokeVehicleOutcome<Output = unknown>(
	client: VehicleClient,
	name: string,
	version: number,
	input: unknown,
	options: VehicleInvocationOptions = {},
): Promise<VehicleInvocationOutcome<Output>> {
	try {
		return { ok: true, value: await client.invoke<Output>(name, version, input, options) };
	} catch (error) {
		if (isVehicleError(error)) return { ok: false, kind: "vehicle-failure", failure: error.toFailure() };
		const operation = options.operationId === undefined ? {} : { operationId: options.operationId };
		if (error instanceof Error && error.name === "AbortError") {
			return { ok: false, kind: "cancelled", message: "Vehicle invocation was cancelled", ...operation };
		}
		if (error instanceof TypeError) {
			return { ok: false, kind: "transport-failure", message: "Vehicle transport failed", retryable: true, ...operation };
		}
		return { ok: false, kind: "unexpected-failure", message: "Vehicle invocation failed unexpectedly", ...operation };
	}
}
