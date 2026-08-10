[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-render](../README.md) / pickIdentityArgument

# Function: pickIdentityArgument()

> **pickIdentityArgument**(`args`, `priorityKeys`, `maxLength?`): `string` \| `undefined`

Defined in: [packages/vehicle-client-pi/src/vehicle-render.ts:118](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-render.ts#L118)

First present, non-empty string value from a priority-ordered key list. Exported so a
domain's own renderCall can reuse this instead of hand-rolling the same lookup.

## Parameters

### args

`unknown`

### priorityKeys

readonly `string`[]

### maxLength?

`number` = `80`

## Returns

`string` \| `undefined`
