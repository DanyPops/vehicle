import {
	DEFAULT_APPROVAL_EFFECTS,
	type JsonValue,
	snapshotVehicleJson,
	strictVehicleJsonSchema,
	VEHICLE_EFFECTS,
	type VehicleOperationDescriptor,
} from "@danypops/vehicle-core";

export interface VehicleContractProjection {
	readonly surface: "pi" | "cli";
	readonly exposedName: string;
	/** Descriptor reconstructed from the adapter's actual registered schema and metadata. */
	readonly descriptor: VehicleOperationDescriptor;
	readonly presentation: "custom" | "generic" | "none";
}
export interface VehicleContractAuditPolicy {
	/** Owner-reviewed permissions suitable for read operations; opaque names carry no inferred authority. */
	readonly readPermissions: readonly string[];
	readonly approvalExemptions?: readonly { readonly operation: string; readonly reason: string }[];
	readonly surfaceExceptions?: readonly { readonly operation: string; readonly surface: "pi" | "cli"; readonly reason: string }[];
}
export interface VehicleContractAuditIssue {
	readonly operation: string;
	readonly code: string;
	readonly surface?: "pi" | "cli";
}
export interface VehicleContractAudit {
	readonly complete: boolean;
	readonly checked: number;
	readonly issues: readonly VehicleContractAuditIssue[];
	readonly truncated: boolean;
}
function canonical(value: JsonValue): string {
	function sorted(entry: JsonValue): JsonValue {
		if (Array.isArray(entry)) return entry.map(sorted);
		if (entry && typeof entry === "object")
			return Object.fromEntries(
				Object.entries(entry)
					.sort(([a], [b]) => a.localeCompare(b))
					.map(([key, child]) => [key, sorted(child)]),
			);
		return entry;
	}
	return JSON.stringify(sorted(value));
}
function key(descriptor: VehicleOperationDescriptor): string {
	if (
		typeof descriptor.name !== "string" ||
		descriptor.name.length < 1 ||
		descriptor.name.length > 128 ||
		!Number.isSafeInteger(descriptor.version) ||
		descriptor.version < 1
	)
		throw new Error("Invalid operation identity");
	return `${descriptor.name}@${descriptor.version}`;
}

/** Audits at most 256 operations and 512 projections under a 1 MiB combined catalog ceiling; emits at most 128 findings. */
export function auditVehicleOperationContracts(
	operations: readonly VehicleOperationDescriptor[],
	projections: readonly VehicleContractProjection[],
	policy: VehicleContractAuditPolicy,
): VehicleContractAudit {
	const issues: VehicleContractAuditIssue[] = [];
	let truncated = false;
	let checked = 0;
	const add = (operation: string, code: string, surface?: "pi" | "cli") => {
		if (issues.length === 128) {
			truncated = true;
			return;
		}
		issues.push({ operation, code, ...(surface ? { surface } : {}) });
	};
	try {
		if (operations.length > 256 || projections.length > 512) throw new Error("Catalog ceiling exceeded");
		const snapshot = snapshotVehicleJson({ operations, projections }, 1_048_576) as unknown as {
			operations: readonly VehicleOperationDescriptor[];
			projections: readonly VehicleContractProjection[];
		};
		operations = snapshot.operations;
		projections = snapshot.projections;
		policy = snapshotVehicleJson(policy, 65_536) as unknown as VehicleContractAuditPolicy;
		if (
			policy.readPermissions.length > 128 ||
			policy.readPermissions.some((permission) => permission.length > 128) ||
			(policy.approvalExemptions?.length ?? 0) > 256 ||
			(policy.surfaceExceptions?.length ?? 0) > 512
		)
			throw new Error("Policy ceiling exceeded");
		const readPermissions = new Set(policy.readPermissions);
		const approvals = new Set<string>();
		const exceptions = new Set<string>();
		for (const entry of policy.approvalExemptions ?? []) {
			if (!entry.reason.trim() || entry.reason.length > 1024 || entry.operation.length > 160) throw new Error("Invalid exemption");
			approvals.add(entry.operation);
		}
		for (const entry of policy.surfaceExceptions ?? []) {
			if (!entry.reason.trim() || entry.reason.length > 1024 || entry.operation.length > 160 || !["pi", "cli"].includes(entry.surface))
				throw new Error("Invalid exemption");
			exceptions.add(`${entry.surface}:${entry.operation}`);
		}
		const catalog = new Map<string, string>();
		for (const descriptor of operations) {
			const identity = key(descriptor);
			checked++;
			if (catalog.has(identity)) add(identity, "duplicate-operation");
			catalog.set(identity, canonical(snapshotVehicleJson(descriptor, 262_144)));
			try {
				strictVehicleJsonSchema(descriptor.inputSchema);
				strictVehicleJsonSchema(descriptor.outputSchema);
			} catch {
				add(identity, "unbounded-schema");
			}
			if (
				!Array.isArray(descriptor.permissions) ||
				descriptor.permissions.length > 64 ||
				descriptor.permissions.some((permission) => typeof permission !== "string" || !permission || permission.length > 128)
			)
				add(identity, "invalid-permissions");
			else if (descriptor.effect === "read" && descriptor.permissions.some((permission) => !readPermissions.has(permission)))
				add(identity, "read-permission");
			if (!VEHICLE_EFFECTS.includes(descriptor.effect)) add(identity, "invalid-effect");
			if (
				!descriptor.idempotency ||
				!["safe", "keyed", "unsafe"].includes(descriptor.idempotency.mode) ||
				(descriptor.idempotency.mode === "keyed" &&
					(!Number.isSafeInteger(descriptor.idempotency.retentionMs) || descriptor.idempotency.retentionMs < 1))
			)
				add(identity, "invalid-idempotency");
			if (DEFAULT_APPROVAL_EFFECTS.includes(descriptor.effect) && descriptor.requiresApproval === false && !approvals.has(identity))
				add(identity, "approval-exemption-required");
			if (
				!descriptor.limits ||
				[
					descriptor.limits.defaultTimeoutMs,
					descriptor.limits.maxTimeoutMs,
					descriptor.limits.maxRequestBytes,
					descriptor.limits.maxResponseBytes,
				].some((limit) => !Number.isSafeInteger(limit) || limit < 1) ||
				descriptor.limits.defaultTimeoutMs > descriptor.limits.maxTimeoutMs
			)
				add(identity, "invalid-limits");
		}
		const seen = new Set<string>();
		const exposed = new Set<string>();
		for (const projection of projections) {
			const identity = key(projection.descriptor);
			if (!["pi", "cli"].includes(projection.surface) || !projection.exposedName || projection.exposedName.length > 128)
				throw new Error("Invalid projection identity");
			const projectedKey = `${projection.surface}:${identity}`;
			const exposedKey = `${projection.surface}:${projection.exposedName}`;
			if (seen.has(projectedKey) || exposed.has(exposedKey)) add(identity, "duplicate-projection", projection.surface);
			seen.add(projectedKey);
			exposed.add(exposedKey);
			if (!catalog.has(identity)) add(identity, "orphan-projection", projection.surface);
			else if (catalog.get(identity) !== canonical(snapshotVehicleJson(projection.descriptor, 262_144)))
				add(identity, "projection-drift", projection.surface);
			if (projection.presentation !== "custom" && projection.presentation !== "generic")
				add(identity, "missing-presentation", projection.surface);
		}
		for (const identity of catalog.keys())
			for (const surface of ["pi", "cli"] as const) {
				if (!seen.has(`${surface}:${identity}`) && !exceptions.has(`${surface}:${identity}`)) add(identity, "missing-projection", surface);
			}
		return { complete: !truncated, checked, issues, truncated };
	} catch {
		add("catalog", "invalid-catalog");
		return { complete: false, checked, issues, truncated };
	}
}
