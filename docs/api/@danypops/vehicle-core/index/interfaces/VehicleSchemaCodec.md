[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / VehicleSchemaCodec

# Interface: VehicleSchemaCodec\<T\>

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:53](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L53)

A serializable, descriptive `jsonSchema` (surfaced to a client or Pi tool
projection) paired with a real `safeParse` that actually enforces it at
runtime -- a Vehicle registry's own `invoke()` only ever calls
`safeParse`; `jsonSchema` alone is never itself enforced, so a codec that
only sets `jsonSchema` without a matching `safeParse` is a documentation
gesture, not an honest contract.

## Type Parameters

### T

`T`

## Properties

### jsonSchema

> `readonly` **jsonSchema**: [`JsonSchema`](../type-aliases/JsonSchema.md)

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:54](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L54)

## Methods

### safeParse()

> **safeParse**(`value`): [`VehicleSchemaResult`](../type-aliases/VehicleSchemaResult.md)\<`T`\>

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:55](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L55)

#### Parameters

##### value

`unknown`

#### Returns

[`VehicleSchemaResult`](../type-aliases/VehicleSchemaResult.md)\<`T`\>
