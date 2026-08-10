[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [session-identity](../README.md) / secretMatches

# Function: secretMatches()

> **secretMatches**(`secret`, `expectedHash`): `boolean`

Defined in: [packages/vehicle-server/src/session-identity.ts:62](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/session-identity.ts#L62)

Constant-time comparison so verification timing cannot leak how many hex characters matched.

## Parameters

### secret

`string`

### expectedHash

`string`

## Returns

`boolean`
