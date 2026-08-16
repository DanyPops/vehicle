/**
 * Vehicle Events pub/sub -- declaration, emission, and local/wildcard subscription. Split out of
 * VehicleRegistry's own bundled responsibilities (Vehicle Pass 1 SRP audit finding #4): this
 * collaborator is fully self-contained, with zero dependency back on the registry that composes
 * it -- emit() only ever touches its own registered events + listener sets.
 */

import { randomUUID } from "node:crypto";
import type { VehicleEvent, VehicleEventDescriptor, VehicleSchemaCodec, VehicleSchemaResult } from "@danypops/vehicle-core";
import { boundedValidationDetails, VehicleError } from "@danypops/vehicle-core";

function eventKey(name: string, version: number): string {
	return `${name}@${version}`;
}

function parseEventPayload<T>(schema: VehicleSchemaCodec<T>, value: unknown, descriptor: VehicleEventDescriptor, eventId: string): T {
	let result: VehicleSchemaResult<T>;
	const key = eventKey(descriptor.name, descriptor.version);
	try {
		result = schema.safeParse(value);
	} catch (error) {
		throw new VehicleError("invalid-payload", `${key} received an invalid event payload`, {
			category: "validation",
			operationId: eventId,
			cause: error,
		});
	}
	if (!result.success) {
		throw new VehicleError("invalid-payload", `${key} received an invalid event payload`, {
			category: "validation",
			operationId: eventId,
			details: boundedValidationDetails(result.issues),
		});
	}
	return result.value;
}

/** Bounds how many bytes a single emitted payload may serialize to -- same bounded-resource
 * discipline invoke() applies to a request/response, duplicated here (not imported) since
 * enforcePayloadSize itself stays with VehicleRegistry's own invoke()/resolveForBackground()
 * request/response enforcement, a genuinely different call shape (kind: "request" | "response"
 * vs. this module's always-"event" framing). */
function enforceEventPayloadSize(value: unknown, maxBytes: number, key: string, eventId: string): void {
	let serialized: string | undefined;
	try {
		serialized = JSON.stringify(value);
	} catch (error) {
		throw new VehicleError("invalid-output", `${key} response is not JSON-serializable`, {
			category: "internal",
			operationId: eventId,
			cause: error,
		});
	}
	if (serialized === undefined) {
		throw new VehicleError("invalid-output", `${key} response is not JSON-serializable`, { category: "internal", operationId: eventId });
	}
	const actualBytes = new TextEncoder().encode(serialized).byteLength;
	if (actualBytes > maxBytes) {
		throw new VehicleError("response-too-large", `${key} response exceeds its ${maxBytes}-byte limit`, {
			category: "capacity",
			operationId: eventId,
			details: { actualBytes, maxBytes },
		});
	}
}

interface EventRegistration {
	readonly owner: string;
	readonly descriptor: VehicleEventDescriptor;
	parsePayload(value: unknown, eventId: string): unknown;
	readonly listeners: Set<(payload: unknown) => void>;
}

/** Bounds a single event's local listener set the same way PushChannel bounds its own connections/topics -- defense in depth against an unbounded subscribe() loop, not a limit any real single-bridge-plus-a-few-widgets usage should ever approach. */
const MAX_LISTENERS_PER_EVENT = 64;

/**
 * Vehicle Events pub/sub, owned by VehicleRegistry as an injected collaborator (`this.eventPubSub`)
 * rather than implemented directly on the registry itself -- registerEvent/emit/subscribeLocal/
 * subscribeAll all delegate here unchanged from the caller's point of view.
 */
export class VehicleEventPubSub {
	private readonly events = new Map<string, EventRegistration>();
	private readonly wildcardListeners = new Set<(name: string, version: number, payload: unknown) => void>();

	/** Declares a named, schema'd event type a handler can later emit() -- the typed replacement for a raw PushChannel.publish() call with a hand-invented topic string. */
	registerEvent<Payload>(owner: string, event: VehicleEvent<Payload>): void {
		if (!owner.trim()) throw new Error("Vehicle event owner must not be empty");
		const { descriptor } = event;
		const key = eventKey(descriptor.name, descriptor.version);
		const existing = this.events.get(key);
		if (existing) {
			throw new VehicleError("duplicate-owner", `${key} is already owned by ${existing.owner}; ${owner} cannot also register it`, {
				category: "conflict",
			});
		}
		this.events.set(key, {
			owner,
			descriptor,
			parsePayload: (value, eventId) => parseEventPayload(event.payload, value, descriptor, eventId),
			listeners: new Set(),
		});
	}

	/**
	 * Validates payload against the declared event's own schema and byte-size
	 * limit (same bounded-resource discipline invoke() applies to a
	 * request/response), then notifies every current local listener --
	 * both a direct subscribeLocal() caller (LocalVehicleClient) and any
	 * wildcard bridge (subscribeAll(), e.g. bridgeVehicleEventsToPushChannel
	 * for remote delivery). A throwing listener is swallowed so one bad
	 * subscriber can never break emit() for every other subscriber or the
	 * handler that's emitting.
	 */
	emit(name: string, version: number, payload: unknown): void {
		const key = eventKey(name, version);
		const registration = this.events.get(key);
		if (!registration) {
			throw new VehicleError("not-found", `No Vehicle event is registered for ${key}`, { category: "not_found" });
		}
		const eventId = randomUUID();
		const parsed = registration.parsePayload(payload, eventId);
		enforceEventPayloadSize(parsed, registration.descriptor.maxPayloadBytes, key, eventId);
		for (const listener of registration.listeners) {
			try {
				listener(parsed);
			} catch {
				// Best-effort fan-out -- see the doc comment above.
			}
		}
		for (const listener of this.wildcardListeners) {
			try {
				listener(name, version, parsed);
			} catch {
				// Best-effort fan-out -- see the doc comment above.
			}
		}
	}

	/** In-process subscription to one declared event, scoped to a caller that already knows its exact name/version -- what LocalVehicleClient.subscribe() is built on. Throws not-found the same way invoke() does for an unregistered operation, rather than silently listening for something that can never fire. */
	subscribeLocal(name: string, version: number, listener: (payload: unknown) => void): () => void {
		const key = eventKey(name, version);
		const registration = this.events.get(key);
		if (!registration) {
			throw new VehicleError("not-found", `No Vehicle event is registered for ${key}`, { category: "not_found" });
		}
		if (registration.listeners.size >= MAX_LISTENERS_PER_EVENT) {
			throw new VehicleError("capacity-exceeded", `${key} already has the maximum of ${MAX_LISTENERS_PER_EVENT} local listeners`, {
				category: "capacity",
			});
		}
		registration.listeners.add(listener);
		return () => registration.listeners.delete(listener);
	}

	/** Every current and future emit(), regardless of event name -- the seam bridgeVehicleEventsToPushChannel uses so a bridge set up once forwards every event a provider declares, including ones registered after the bridge itself. */
	subscribeAll(listener: (name: string, version: number, payload: unknown) => void): () => void {
		this.wildcardListeners.add(listener);
		return () => this.wildcardListeners.delete(listener);
	}

	/** Every currently-registered event's own descriptor, for VehicleRegistry.manifest(). */
	descriptors(): VehicleEventDescriptor[] {
		return [...this.events.values()].map((registration) => registration.descriptor);
	}
}
