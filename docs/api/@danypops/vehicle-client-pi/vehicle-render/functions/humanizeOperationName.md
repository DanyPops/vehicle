[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-render](../README.md) / humanizeOperationName

# Function: humanizeOperationName()

> **humanizeOperationName**(`name`): `string`

Defined in: [packages/vehicle-client-pi/src/vehicle-render.ts:211](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-render.ts#L211)

"tasks.cancel_subtree" -> "Tasks Cancel Subtree": a mechanical, domain-agnostic
transform (split on "." and "_", title-case each word), not a lookup table -- works
the same for any "domain.action" operation name regardless of which Vehicle it's from.

## Parameters

### name

`string`

## Returns

`string`
