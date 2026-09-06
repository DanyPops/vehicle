import { LocalVehicleClient } from "@danypops/vehicle-client/local";
import { bindVehicleOperation, isVehicleError, projectVehicleOperation } from "@danypops/vehicle-core";
import { defineStrictVehicleOperation } from "@danypops/vehicle-core/typebox";
import { VehicleRegistry } from "@danypops/vehicle-server";
import { Type } from "typebox";

const record = Type.Object(
	{ prefix: Type.String({ maxLength: 8 }), limit: Type.Integer({ minimum: 1, maximum: 3 }) },
	{ additionalProperties: false },
);
export const strictOperation = defineStrictVehicleOperation({
	name: "records.list",
	version: 1,
	description: "Returns the validated selection.",
	input: Type.Object({ selection: record }, { additionalProperties: false }),
	output: Type.Object({ selection: record }, { additionalProperties: false }),
	permissions: ["records:read"],
	effect: "read",
	idempotency: { mode: "safe" },
	limits: { defaultTimeoutMs: 1000, maxTimeoutMs: 2000, maxRequestBytes: 1024, maxResponseBytes: 1024 },
});
export function strictClient(): LocalVehicleClient {
	const registry = new VehicleRegistry({ name: "strict-fixture", version: "1.0.0", description: "Strict operation fixture." });
	registry.register(
		"records",
		bindVehicleOperation(
			strictOperation,
			() =>
				async ({ input }) =>
					input,
		),
	);
	return new LocalVehicleClient(registry);
}

if (import.meta.main) {
	const client = strictClient();
	const { FIXTURE_DENY } = process.env;
	try {
		const projection = projectVehicleOperation(strictOperation);
		const args = process.argv.slice(2);
		if (args.length === 1 && args[0] === "--help") console.log(projection.help);
		else
			console.log(
				JSON.stringify(
					await projection.invoke(client, projection.parseArgs(args), {
						permissions: FIXTURE_DENY === "1" ? [] : ["records:read"],
					}),
				),
			);
	} catch (error) {
		console.log(JSON.stringify({ error: isVehicleError(error) ? error.code : "command-failed" }));
		process.exitCode = 1;
	} finally {
		await client.close();
	}
}
