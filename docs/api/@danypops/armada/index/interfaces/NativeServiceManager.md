[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/armada](../../README.md) / [index](../README.md) / NativeServiceManager

# Interface: NativeServiceManager

Defined in: [native/service-manager.ts:55](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/native/service-manager.ts#L55)

## Extended by

- [`NativeServiceController`](NativeServiceController.md)

## Properties

### capabilities

> `readonly` **capabilities**: [`NativeManagerCapabilities`](NativeManagerCapabilities.md)

Defined in: [native/service-manager.ts:57](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/native/service-manager.ts#L57)

***

### kind

> `readonly` **kind**: [`NativeManagerKind`](../type-aliases/NativeManagerKind.md)

Defined in: [native/service-manager.ts:56](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/native/service-manager.ts#L56)

## Methods

### inspect()

> **inspect**(`vehicles`): `Promise`\<[`InspectionOutcome`](../type-aliases/InspectionOutcome.md)\>

Defined in: [native/service-manager.ts:58](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/native/service-manager.ts#L58)

#### Parameters

##### vehicles

readonly [`VehicleSpec`](VehicleSpec.md)[]

#### Returns

`Promise`\<[`InspectionOutcome`](../type-aliases/InspectionOutcome.md)\>
