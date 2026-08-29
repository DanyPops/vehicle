export const VEHICLE_PROTOCOL_VERSION = 1;
export const MAX_VEHICLE_PROTOCOL_CAPABILITIES = 64;
export const MAX_VEHICLE_PROTOCOL_CAPABILITY_LENGTH = 128;
export const MAX_VEHICLE_PROTOCOL_OFFER_BYTES = 16 * 1024;

/** Describes the wire versions and optional features one Vehicle server can serve. */
export interface VehicleProtocolSupport {
	readonly minimumVersion: number;
	readonly maximumVersion: number;
	readonly capabilities: readonly string[];
}

/** Describes the compatibility range and features one client requests before invoking operations. */
export interface VehicleProtocolOffer {
	readonly minimumVersion: number;
	readonly maximumVersion: number;
	readonly requiredCapabilities: readonly string[];
	readonly optionalCapabilities: readonly string[];
}

/** Records the highest shared wire version and capabilities accepted by both peers. */
export interface VehicleProtocolAgreement {
	readonly version: number;
	readonly capabilities: readonly string[];
}

export type VehicleProtocolNegotiationFailureCode =
	| "protocol-offer-invalid"
	| "protocol-support-invalid"
	| "protocol-version-incompatible"
	| "protocol-capability-unsupported";

export type VehicleProtocolNegotiationResult =
	| { readonly ok: true; readonly value: VehicleProtocolAgreement }
	| { readonly ok: false; readonly code: VehicleProtocolNegotiationFailureCode; readonly message: string };

export const DEFAULT_VEHICLE_PROTOCOL_SUPPORT: VehicleProtocolSupport = Object.freeze({
	minimumVersion: VEHICLE_PROTOCOL_VERSION,
	maximumVersion: VEHICLE_PROTOCOL_VERSION,
	capabilities: Object.freeze([]),
});

function validVersionRange(minimumVersion: number, maximumVersion: number): boolean {
	return (
		Number.isSafeInteger(minimumVersion) &&
		minimumVersion > 0 &&
		Number.isSafeInteger(maximumVersion) &&
		maximumVersion >= minimumVersion
	);
}

function validCapabilities(capabilities: unknown): capabilities is readonly string[] {
	if (!Array.isArray(capabilities) || capabilities.length > MAX_VEHICLE_PROTOCOL_CAPABILITIES) return false;
	const unique = new Set<string>();
	for (const capability of capabilities) {
		if (!capability.trim() || capability.length > MAX_VEHICLE_PROTOCOL_CAPABILITY_LENGTH || unique.has(capability)) return false;
		unique.add(capability);
	}
	return true;
}

/** Validates a protocol agreement received across an untrusted wire boundary. */
export function isVehicleProtocolAgreement(value: unknown): value is VehicleProtocolAgreement {
	if (typeof value !== "object" || value === null) return false;
	const agreement = value as { version?: unknown; capabilities?: unknown };
	return Number.isSafeInteger(agreement.version) && (agreement.version as number) > 0 && validCapabilities(agreement.capabilities);
}

/** Negotiates one bounded protocol agreement without performing transport I/O. */
export function negotiateVehicleProtocol(
	support: VehicleProtocolSupport,
	offer: VehicleProtocolOffer,
): VehicleProtocolNegotiationResult {
	if (!validVersionRange(support.minimumVersion, support.maximumVersion) || !validCapabilities(support.capabilities)) {
		return { ok: false, code: "protocol-support-invalid", message: "Vehicle protocol support is malformed or exceeds its capability bound" };
	}
	if (
		!validVersionRange(offer.minimumVersion, offer.maximumVersion) ||
		!validCapabilities(offer.requiredCapabilities) ||
		!validCapabilities(offer.optionalCapabilities) ||
		offer.requiredCapabilities.length + offer.optionalCapabilities.length > MAX_VEHICLE_PROTOCOL_CAPABILITIES
	) {
		return { ok: false, code: "protocol-offer-invalid", message: "Vehicle protocol offer is malformed or exceeds its capability bound" };
	}

	const minimumSharedVersion = Math.max(support.minimumVersion, offer.minimumVersion);
	const maximumSharedVersion = Math.min(support.maximumVersion, offer.maximumVersion);
	if (minimumSharedVersion > maximumSharedVersion) {
		return {
			ok: false,
			code: "protocol-version-incompatible",
			message: `Vehicle protocol versions do not overlap: server ${support.minimumVersion}-${support.maximumVersion}, client ${offer.minimumVersion}-${offer.maximumVersion}`,
		};
	}

	const supported = new Set(support.capabilities);
	for (const capability of offer.requiredCapabilities) {
		if (!supported.has(capability)) {
			return {
				ok: false,
				code: "protocol-capability-unsupported",
				message: `Vehicle protocol requires unsupported capability "${capability}"`,
			};
		}
	}

	const capabilities = [...offer.requiredCapabilities];
	for (const capability of offer.optionalCapabilities) {
		if (supported.has(capability) && !capabilities.includes(capability)) capabilities.push(capability);
	}
	return { ok: true, value: Object.freeze({ version: maximumSharedVersion, capabilities: Object.freeze(capabilities) }) };
}
