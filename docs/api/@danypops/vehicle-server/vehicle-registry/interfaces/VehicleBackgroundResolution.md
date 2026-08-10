[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [vehicle-registry](../README.md) / VehicleBackgroundResolution

# Interface: VehicleBackgroundResolution

Defined in: [packages/vehicle-server/src/vehicle-registry.ts:251](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-registry.ts#L251)

Everything VehicleJobStore needs to run a background op detached: validated descriptor/capability, parsed input, and a run() that validates the result like invoke() does.

## Properties

### background

> `readonly` **background**: `VehicleBackgroundCapability`

Defined in: [packages/vehicle-server/src/vehicle-registry.ts:253](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-registry.ts#L253)

***

### descriptor

> `readonly` **descriptor**: `VehicleOperationDescriptor`

Defined in: [packages/vehicle-server/src/vehicle-registry.ts:252](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-registry.ts#L252)

***

### operationId

> `readonly` **operationId**: `string`

Defined in: [packages/vehicle-server/src/vehicle-registry.ts:254](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-registry.ts#L254)

***

### parsedInput

> `readonly` **parsedInput**: `unknown`

Defined in: [packages/vehicle-server/src/vehicle-registry.ts:255](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-registry.ts#L255)

## Methods

### run()

> **run**(`context`): `Promise`\<`unknown`\>

Defined in: [packages/vehicle-server/src/vehicle-registry.ts:256](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-registry.ts#L256)

#### Parameters

##### context

`VehicleOperationContext`\<`unknown`\>

#### Returns

`Promise`\<`unknown`\>
