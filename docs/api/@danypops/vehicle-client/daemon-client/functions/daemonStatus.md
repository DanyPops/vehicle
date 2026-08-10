[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client](../../README.md) / [daemon-client](../README.md) / daemonStatus

# Function: daemonStatus()

> **daemonStatus**\<`Handle`, `Client`\>(`options`): `Promise`\<[`DaemonStatus`](../interfaces/DaemonStatus.md)\>

Defined in: [packages/vehicle-client/src/daemon-client.ts:718](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L718)

Answers "is a daemon running, which version, since when, is it healthy"
without the user (or the extension debugging on their behalf) needing to
read the handle file or run `ps` by hand -- the one diagnostic surface
every consumer's CLI can expose as `<name> status` for parity with the
rest of this house's daemon-backed CLIs.

## Type Parameters

### Handle

`Handle` *extends* [`DaemonHandleLike`](../interfaces/DaemonHandleLike.md)

### Client

`Client`

## Parameters

### options

[`DaemonStatusOptions`](../interfaces/DaemonStatusOptions.md)\<`Handle`, `Client`\>

## Returns

`Promise`\<[`DaemonStatus`](../interfaces/DaemonStatus.md)\>
