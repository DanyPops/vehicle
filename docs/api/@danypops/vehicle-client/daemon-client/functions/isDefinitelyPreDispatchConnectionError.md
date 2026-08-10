[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client](../../README.md) / [daemon-client](../README.md) / isDefinitelyPreDispatchConnectionError

# Function: isDefinitelyPreDispatchConnectionError()

> **isDefinitelyPreDispatchConnectionError**(`error`): `boolean`

Defined in: [packages/vehicle-client/src/daemon-client.ts:94](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L94)

Conservative classifier for failures proving no request reached the daemon. A bare
`fetch failed`, timeout, reset, or abort is deliberately excluded: those can happen
after the server applied a mutation but before the response reached the caller.

## Parameters

### error

`unknown`

## Returns

`boolean`
