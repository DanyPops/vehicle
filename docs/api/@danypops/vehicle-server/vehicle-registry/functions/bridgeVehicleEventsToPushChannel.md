[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [vehicle-registry](../README.md) / bridgeVehicleEventsToPushChannel

# Function: bridgeVehicleEventsToPushChannel()

> **bridgeVehicleEventsToPushChannel**(`registry`, `publisher`): () => `void`

Defined in: [packages/vehicle-server/src/vehicle-registry.ts:894](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-registry.ts#L894)

Forwards every event a registry emits onto a PushChannel-shaped publish
sink, under the shared vehicleEventTopic() naming convention
RemoteVehicleClient.subscribe() expects -- the remote-delivery half of
Vehicle Events. Call once at composition-root time, after the registry's
providers have registered (or before -- subscribeAll() catches every
future emit() too, regardless of registration order). Returns a teardown
matching subscribeAll()'s own unsubscribe shape.

Takes a structural VehicleEventPublisher, not a concrete PushChannel
import -- PushChannel already satisfies this with its own publish()
method, so a daemon wires this as
`bridgeVehicleEventsToPushChannel(registry, pushChannel)` with zero
extra glue, while this file itself stays free of a cross-build-config
dependency on push-channel.ts (a separate tsconfig entry point).

## Parameters

### registry

[`VehicleRegistry`](../classes/VehicleRegistry.md)

### publisher

[`VehicleEventPublisher`](../interfaces/VehicleEventPublisher.md)

## Returns

() => `void`
