import { expect, it } from "bun:test";
import { defineVehicleOperation, type VehicleOperationDescriptor } from "@danypops/vehicle-core";
import { defineStrictVehicleSchema } from "@danypops/vehicle-core/typebox";
import { Type } from "typebox";
import { auditVehicleOperationContracts, type VehicleContractProjection } from "../src/operation-contracts.ts";

const schema = defineStrictVehicleSchema(Type.Object({ name: Type.String({ maxLength: 16 }) }, { additionalProperties: false }));
const operation = defineVehicleOperation({
	name: "records.read",
	version: 1,
	description: "Reads records.",
	input: schema,
	output: schema,
	effect: "read",
	permissions: ["records:read"],
	idempotency: { mode: "safe" },
	limits: { defaultTimeoutMs: 10, maxTimeoutMs: 100, maxRequestBytes: 1024, maxResponseBytes: 1024 },
}).descriptor;
const policy = { readPermissions: ["records:read"] };
const projections = (): VehicleContractProjection[] =>
	["pi", "cli"].map((surface) => ({
		surface: surface as "pi" | "cli",
		descriptor: operation,
		exposedName: `records_${surface}`,
		presentation: "custom",
	}));

it("accepts matching bounded contracts", () => {
	expect(auditVehicleOperationContracts([operation], projections(), policy)).toEqual({
		complete: true,
		checked: 1,
		issues: [],
		truncated: false,
	});
});

it("detects missing, duplicate and orphan projections", () => {
	const projected = projections();
	projected[1] = { ...projected[0]! };
	projected.push({ ...projected[0]!, descriptor: { ...operation, name: "unknown" } });
	const result = auditVehicleOperationContracts([operation], projected, policy);
	expect(result.issues.map((issue) => issue.code)).toEqual(
		expect.arrayContaining(["missing-projection", "duplicate-projection", "orphan-projection"]),
	);
});

it("detects input and policy drift", () => {
	const projected = projections();
	projected[0] = { ...projected[0]!, descriptor: { ...operation, inputSchema: { type: "object" }, permissions: [] } };
	expect(auditVehicleOperationContracts([operation], projected, policy).issues.some((issue) => issue.code === "projection-drift")).toBe(
		true,
	);
});

it("audits bounds, read permissions, idempotency and presentation", () => {
	const bad = {
		...operation,
		permissions: ["records:write"],
		outputSchema: { type: "object" },
		idempotency: { mode: "unknown" },
	} as unknown as VehicleOperationDescriptor;
	const result = auditVehicleOperationContracts(
		[bad],
		projections().map((projection) => ({ ...projection, descriptor: bad, presentation: "none" })),
		policy,
	);
	expect(result.issues.map((issue) => issue.code)).toEqual(
		expect.arrayContaining(["unbounded-schema", "read-permission", "invalid-idempotency", "missing-presentation"]),
	);
});

it("requires reviewed approval and surface exemptions", () => {
	const risky = { ...operation, effect: "external-write", requiresApproval: false } as const;
	const projected = [{ ...projections()[0]!, descriptor: risky }];
	const result = auditVehicleOperationContracts([risky], projected, policy);
	expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["approval-exemption-required", "missing-projection"]));
	const approved = auditVehicleOperationContracts([risky], projected, {
		...policy,
		approvalExemptions: [{ operation: "records.read@1", reason: "Reviewed fixture operation." }],
		surfaceExceptions: [{ operation: "records.read@1", surface: "cli", reason: "Session-local fixture." }],
	});
	expect(approved.issues).toHaveLength(0);
});

it("bounds catalogs and reports truncated findings", () => {
	const operations = Array.from({ length: 200 }, (_, i) => ({ ...operation, name: `records.read${i}` }));
	const result = auditVehicleOperationContracts(operations, [], policy);
	expect(result.truncated).toBe(true);
	expect(result.complete).toBe(false);
	expect(result.issues.length).toBeLessThanOrEqual(128);
	expect(auditVehicleOperationContracts(Array(257).fill(operation), [], policy).complete).toBe(false);
});
