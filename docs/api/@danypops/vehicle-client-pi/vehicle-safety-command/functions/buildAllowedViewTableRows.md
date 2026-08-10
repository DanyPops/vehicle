[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-safety-command](../README.md) / buildAllowedViewTableRows

# Function: buildAllowedViewTableRows()

> **buildAllowedViewTableRows**(`rows`): `Record`\<`string`, `string`\>[]

Defined in: [packages/vehicle-client-pi/src/vehicle-safety-command.ts:134](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety-command.ts#L134)

Filtered to allow-state rows only -- the state column is dropped, redundant once every row is the same state.

## Parameters

### rows

readonly [`VehicleSafetyRow`](../interfaces/VehicleSafetyRow.md)[]

## Returns

`Record`\<`string`, `string`\>[]
