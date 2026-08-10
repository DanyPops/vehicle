[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / DefineVehicleOperationOptions

# Interface: DefineVehicleOperationOptions\<Input, Output\>

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:219](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L219)

## Type Parameters

### Input

`Input`

### Output

`Output`

## Properties

### background?

> `readonly` `optional` **background?**: [`VehicleBackgroundCapability`](VehicleBackgroundCapability.md)

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:232](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L232)

***

### description

> `readonly` **description**: `string`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:222](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L222)

***

### effect

> `readonly` **effect**: [`VehicleEffect`](../type-aliases/VehicleEffect.md)

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:226](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L226)

***

### errors?

> `readonly` `optional` **errors?**: readonly [`VehicleFailureDescriptor`](VehicleFailureDescriptor.md)[]

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:231](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L231)

***

### idempotency

> `readonly` **idempotency**: [`VehicleIdempotency`](../type-aliases/VehicleIdempotency.md)

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:227](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L227)

***

### input

> `readonly` **input**: [`VehicleSchemaCodec`](VehicleSchemaCodec.md)\<`Input`\>

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:223](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L223)

***

### limits

> `readonly` **limits**: [`VehicleLimits`](VehicleLimits.md)

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:230](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L230)

***

### longRunning?

> `readonly` `optional` **longRunning?**: `boolean`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:229](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L229)

***

### name

> `readonly` **name**: `string`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:220](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L220)

***

### output

> `readonly` **output**: [`VehicleSchemaCodec`](VehicleSchemaCodec.md)\<`Output`\>

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:224](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L224)

***

### permissions?

> `readonly` `optional` **permissions?**: readonly `string`[]

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:225](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L225)

***

### streaming?

> `readonly` `optional` **streaming?**: `boolean`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:228](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L228)

***

### version

> `readonly` **version**: `number`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:221](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L221)
