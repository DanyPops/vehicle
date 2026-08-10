[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [paths](../README.md) / writeDaemonHandle

# Function: writeDaemonHandle()

> **writeDaemonHandle**(`handlePath`, `handle`, `mode?`): `void`

Defined in: [packages/vehicle-server/src/paths.ts:144](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/paths.ts#L144)

Atomic write-then-rename so a reader never observes a partial handle file.
mode defaults to 0600 (owner-only) -- correct for the common case of a
same-user daemon and consumer. A daemon meant to be discovered across OS
users (e.g. a system service like a shared credential vault) can pass
0644: the handle's own content (host/port/pid) is never sensitive, unlike
the daemon's own auth token, which stays owner-only regardless.

## Parameters

### handlePath

`string`

### handle

[`DaemonHandle`](../interfaces/DaemonHandle.md)

### mode?

`number` = `0o600`

## Returns

`void`
