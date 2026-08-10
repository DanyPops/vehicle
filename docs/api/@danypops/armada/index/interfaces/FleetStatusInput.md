[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/armada](../../README.md) / [index](../README.md) / FleetStatusInput

# Interface: FleetStatusInput

Defined in: [fleet/status.ts:38](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/fleet/status.ts#L38)

## Properties

### executableExists

> `readonly` **executableExists**: (`path`) => `boolean`

Defined in: [fleet/status.ts:44](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/fleet/status.ts#L44)

#### Parameters

##### path

`string`

#### Returns

`boolean`

***

### handles

> `readonly` **handles**: `ReadonlyMap`\<[`VehicleName`](../type-aliases/VehicleName.md), [`ObservedVehicleHandle`](ObservedVehicleHandle.md)\>

Defined in: [fleet/status.ts:42](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/fleet/status.ts#L42)

***

### manifest

> `readonly` **manifest**: [`ArmadaManifest`](ArmadaManifest.md)

Defined in: [fleet/status.ts:39](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/fleet/status.ts#L39)

***

### nativeServices

> `readonly` **nativeServices**: readonly [`NativeServiceState`](NativeServiceState.md)[]

Defined in: [fleet/status.ts:40](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/fleet/status.ts#L40)

***

### processes

> `readonly` **processes**: readonly [`ObservedProcess`](ObservedProcess.md)[]

Defined in: [fleet/status.ts:41](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/fleet/status.ts#L41)

***

### strategy

> `readonly` **strategy**: [`NativeServiceStrategy`](NativeServiceStrategy.md)

Defined in: [fleet/status.ts:43](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/fleet/status.ts#L43)
