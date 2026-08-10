[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / defineErrorMapping

# Function: defineErrorMapping()

> **defineErrorMapping**(`rules`, `options?`): \<`T`\>(`run`) => `Promise`\<`T`\>

Defined in: [packages/vehicle-core/src/vehicle-errors.ts:89](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-errors.ts#L89)

Maps reviewed domain errors into wire-safe Vehicle errors while preserving already-mapped failures.

## Parameters

### rules

readonly [`VehicleErrorMapping`](../type-aliases/VehicleErrorMapping.md)[]

### options?

[`DefineErrorMappingOptions`](../interfaces/DefineErrorMappingOptions.md) = `{}`

## Returns

\<`T`\>(`run`) => `Promise`\<`T`\>
