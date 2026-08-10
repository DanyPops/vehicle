[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [paths](../README.md) / releaseDaemonLock

# Function: releaseDaemonLock()

> **releaseDaemonLock**(`lockPath`): `void`

Defined in: [packages/vehicle-server/src/paths.ts:282](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/paths.ts#L282)

Releases the single-instance lock. Idempotent -- safe to call even if this process never held it.

## Parameters

### lockPath

`string`

## Returns

`void`
