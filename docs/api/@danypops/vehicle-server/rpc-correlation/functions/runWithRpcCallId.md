[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [rpc-correlation](../README.md) / runWithRpcCallId

# Function: runWithRpcCallId()

> **runWithRpcCallId**\<`T`\>(`id`, `fn`): `T`

Defined in: [packages/vehicle-server/src/rpc-correlation.ts:38](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/rpc-correlation.ts#L38)

Runs `fn` with `id` bound as the current rpcCallId for the duration of its whole async execution, however many `await`s deep.

## Type Parameters

### T

`T`

## Parameters

### id

`string`

### fn

() => `T`

## Returns

`T`
