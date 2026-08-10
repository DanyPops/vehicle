[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/armada](../../README.md) / [index](../README.md) / readVehicleHandles

# Function: readVehicleHandles()

> **readVehicleHandles**(`vehicles`, `readHandle`): `Promise`\<`ReadonlyMap`\<[`VehicleName`](../type-aliases/VehicleName.md), [`ObservedVehicleHandle`](../interfaces/ObservedVehicleHandle.md)\>\>

Defined in: [fleet/host-inspection.ts:51](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/fleet/host-inspection.ts#L51)

## Parameters

### vehicles

readonly [`VehicleSpec`](../interfaces/VehicleSpec.md)[]

### readHandle

(`path`) => `Promise`\<`unknown`\>

## Returns

`Promise`\<`ReadonlyMap`\<[`VehicleName`](../type-aliases/VehicleName.md), [`ObservedVehicleHandle`](../interfaces/ObservedVehicleHandle.md)\>\>
