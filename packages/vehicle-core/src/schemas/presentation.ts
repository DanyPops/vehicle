/** Shared defense-in-depth vocabulary for credential-shaped fields at every Vehicle projection boundary. */
export const VEHICLE_CREDENTIAL_FIELD_NAMES = Object.freeze([
	"password",
	"token",
	"accessToken",
	"refreshToken",
	"apiKey",
	"secret",
	"authorization",
	"credential",
] as const);

const NORMALIZED_VEHICLE_CREDENTIAL_FIELD_NAMES = new Set(
	VEHICLE_CREDENTIAL_FIELD_NAMES.map((name) => name.replace(/[^a-z0-9]/gi, "").toLowerCase()),
);

/** Case/separator-insensitive credential-name check used as a fallback when a schema annotation is missing. */
export function isVehicleCredentialFieldName(name: string): boolean {
	return NORMALIZED_VEHICLE_CREDENTIAL_FIELD_NAMES.has(name.replace(/[^a-z0-9]/gi, "").toLowerCase());
}

/**
 * JSON Schema property annotation consumed by human-facing Vehicle adapters.
 * `omit` hides the field; `summarize` may show shape/size but never its value;
 * `stream` exposes a string through a bounded, tail-following call preview while
 * the host receives partial tool arguments, then collapses it to a size summary.
 * Standard `writeOnly: true` and `format: "password"` always imply omission.
 */
export const VEHICLE_SCHEMA_PRESENTATION_EXTENSION = "x-vehicle-presentation" as const;
export type VehicleSchemaPresentation = "omit" | "summarize" | "stream";
