/** Canonical list VehicleEffect is itself derived from, so a runtime discriminator check (e.g. a persisted/wire VehicleApprovalRequest's own `effect` field) has one real source to check against instead of a second, driftable hardcoded list. */
export const VEHICLE_EFFECTS = ["read", "local-write", "external-write", "destructive", "open-world"] as const;
export type VehicleEffect = (typeof VEHICLE_EFFECTS)[number];
