[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [vehicle-registry](../README.md) / VehicleEventPublisher

# Interface: VehicleEventPublisher

Defined in: [packages/vehicle-server/src/vehicle-registry.ts:91](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-registry.ts#L91)

A publish(topic, payload) sink -- PushChannel satisfies this structurally with zero import needed; see bridgeVehicleEventsToPushChannel below.

## Methods

### publish()

> **publish**(`topic`, `payload`): `void`

Defined in: [packages/vehicle-server/src/vehicle-registry.ts:92](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-registry.ts#L92)

#### Parameters

##### topic

`string`

##### payload

`unknown`

#### Returns

`void`
