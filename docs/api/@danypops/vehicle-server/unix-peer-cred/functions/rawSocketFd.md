[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [unix-peer-cred](../README.md) / rawSocketFd

# Function: rawSocketFd()

> **rawSocketFd**(`socket`): `number` \| `undefined`

Defined in: [packages/vehicle-server/src/unix-peer-cred.ts:85](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/unix-peer-cred.ts#L85)

Bun exposes a connected socket's raw fd only via an undocumented `.fd`
property on the object passed to `Bun.listen`'s `socket.open(socket)`
handler -- centralized here so every call site shares one guarded
accessor instead of repeating the same unchecked cast.

## Parameters

### socket

`unknown`

## Returns

`number` \| `undefined`
