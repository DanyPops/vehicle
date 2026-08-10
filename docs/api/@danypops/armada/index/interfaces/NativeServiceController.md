[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/armada](../../README.md) / [index](../README.md) / NativeServiceController

# Interface: NativeServiceController

Defined in: [native/service-manager.ts:65](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/native/service-manager.ts#L65)

## Extends

- [`NativeServiceManager`](NativeServiceManager.md)

## Properties

### capabilities

> `readonly` **capabilities**: [`NativeManagerCapabilities`](NativeManagerCapabilities.md)

Defined in: [native/service-manager.ts:57](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/native/service-manager.ts#L57)

#### Inherited from

[`NativeServiceManager`](NativeServiceManager.md).[`capabilities`](NativeServiceManager.md#capabilities)

***

### kind

> `readonly` **kind**: [`NativeManagerKind`](../type-aliases/NativeManagerKind.md)

Defined in: [native/service-manager.ts:56](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/native/service-manager.ts#L56)

#### Inherited from

[`NativeServiceManager`](NativeServiceManager.md).[`kind`](NativeServiceManager.md#kind)

## Methods

### inspect()

> **inspect**(`vehicles`): `Promise`\<[`InspectionOutcome`](../type-aliases/InspectionOutcome.md)\>

Defined in: [native/service-manager.ts:58](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/native/service-manager.ts#L58)

#### Parameters

##### vehicles

readonly [`VehicleSpec`](VehicleSpec.md)[]

#### Returns

`Promise`\<[`InspectionOutcome`](../type-aliases/InspectionOutcome.md)\>

#### Inherited from

[`NativeServiceManager`](NativeServiceManager.md).[`inspect`](NativeServiceManager.md#inspect)

***

### remove()

> **remove**(`identity`): `Promise`\<[`NativeOperationOutcome`](../type-aliases/NativeOperationOutcome.md)\>

Defined in: [native/service-manager.ts:69](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/native/service-manager.ts#L69)

#### Parameters

##### identity

[`NativeServiceIdentity`](../type-aliases/NativeServiceIdentity.md)

#### Returns

`Promise`\<[`NativeOperationOutcome`](../type-aliases/NativeOperationOutcome.md)\>

***

### replaceDescriptorAtomically()

> **replaceDescriptorAtomically**(`descriptor`): `Promise`\<[`NativeOperationOutcome`](../type-aliases/NativeOperationOutcome.md)\>

Defined in: [native/service-manager.ts:66](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/native/service-manager.ts#L66)

#### Parameters

##### descriptor

[`NativeServiceDescriptor`](NativeServiceDescriptor.md)

#### Returns

`Promise`\<[`NativeOperationOutcome`](../type-aliases/NativeOperationOutcome.md)\>

***

### start()

> **start**(`identity`): `Promise`\<[`NativeOperationOutcome`](../type-aliases/NativeOperationOutcome.md)\>

Defined in: [native/service-manager.ts:67](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/native/service-manager.ts#L67)

#### Parameters

##### identity

[`NativeServiceIdentity`](../type-aliases/NativeServiceIdentity.md)

#### Returns

`Promise`\<[`NativeOperationOutcome`](../type-aliases/NativeOperationOutcome.md)\>

***

### stop()

> **stop**(`identity`): `Promise`\<[`NativeOperationOutcome`](../type-aliases/NativeOperationOutcome.md)\>

Defined in: [native/service-manager.ts:68](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/native/service-manager.ts#L68)

#### Parameters

##### identity

[`NativeServiceIdentity`](../type-aliases/NativeServiceIdentity.md)

#### Returns

`Promise`\<[`NativeOperationOutcome`](../type-aliases/NativeOperationOutcome.md)\>
