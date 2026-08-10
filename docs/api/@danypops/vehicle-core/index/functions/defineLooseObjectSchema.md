[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / defineLooseObjectSchema

# Function: defineLooseObjectSchema()

> **defineLooseObjectSchema**(`properties`, `required?`): [`VehicleSchemaCodec`](../interfaces/VehicleSchemaCodec.md)\<`Record`\<`string`, `unknown`\>\>

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:78](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L78)

A VehicleRegistry only ever calls a schema's own safeParse -- jsonSchema is
descriptive metadata surfaced to a client/Pi projection, never itself
enforced at runtime -- so a declared `enum` has to be checked here for
real, or it's a documentation gesture, not an honest contract. Every
consumer projecting a plain-object input onto a VehicleOperation needs the
same required/enum checks; this is that check written once.

## Parameters

### properties

`Record`\<`string`, [`LooseObjectProperty`](../interfaces/LooseObjectProperty.md)\>

### required?

readonly `string`[] = `[]`

## Returns

[`VehicleSchemaCodec`](../interfaces/VehicleSchemaCodec.md)\<`Record`\<`string`, `unknown`\>\>
