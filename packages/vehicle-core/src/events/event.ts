import { cloneJson, type JsonSchema } from "../schemas/json.js";
import type { VehicleSchemaCodec } from "../schemas/codec.js";

/**
 * A named, schema'd event type a provider declares as part of its
 * manifest -- the typed alternative to a raw PushChannel.publish(topic,
 * payload) call with a hand-invented topic string. No `available` flag the
 * way an operation has one: an event type, once declared, is always
 * emittable -- there's no credential-gated "this event is currently
 * unavailable" concept the way a live external-service-backed operation
 * can have.
 */
export interface VehicleEventDescriptor {
	readonly name: string;
	readonly version: number;
	readonly description: string;
	readonly payloadSchema: JsonSchema;
	/** Same bounded-resource discipline as an operation's own maxRequestBytes/maxResponseBytes -- required, never silently defaulted. */
	readonly maxPayloadBytes: number;
}

export interface VehicleEvent<Payload> {
	readonly descriptor: VehicleEventDescriptor;
	readonly payload: VehicleSchemaCodec<Payload>;
}

export interface DefineVehicleEventOptions<Payload> {
	readonly name: string;
	readonly version: number;
	readonly description: string;
	readonly payload: VehicleSchemaCodec<Payload>;
	readonly maxPayloadBytes: number;
}

function validateEventMetadata<Payload>(options: DefineVehicleEventOptions<Payload>): void {
	if (!options.name.trim()) throw new Error("Vehicle event name must not be empty");
	if (!Number.isInteger(options.version) || options.version < 1) {
		throw new Error("Vehicle event version must be a positive integer");
	}
	if (!options.description.trim()) throw new Error("Vehicle event description must not be empty");
	if (!Number.isSafeInteger(options.maxPayloadBytes) || options.maxPayloadBytes < 1) {
		throw new Error("Vehicle event maxPayloadBytes must be a positive integer");
	}
}

export function defineVehicleEvent<Payload>(options: DefineVehicleEventOptions<Payload>): VehicleEvent<Payload> {
	validateEventMetadata(options);
	const descriptor: VehicleEventDescriptor = Object.freeze({
		name: options.name,
		version: options.version,
		description: options.description,
		payloadSchema: cloneJson(options.payload.jsonSchema),
		maxPayloadBytes: options.maxPayloadBytes,
	});
	return Object.freeze({ descriptor, payload: options.payload });
}

export type VehicleManifestEvent = VehicleEventDescriptor;

export type VehicleEventHandler<Payload> = (payload: Payload) => void;

/**
 * The wire topic name a bridge (bridgeVehicleEventsToPushChannel, in
 * vehicle-server) publishes an event under, and a subscriber
 * (RemoteVehicleClient.subscribe()) subscribes to -- one shared naming
 * function in vehicle-core so both sides can never drift apart on the
 * convention, the same failure mode this primitive exists to prevent
 * providers from reinventing per-project.
 */
export function vehicleEventTopic(name: string, version: number): string {
	return `vehicle-event:${name}@${version}`;
}
