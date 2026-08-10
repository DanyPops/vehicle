[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [unix-peer-cred](../README.md) / getPeerCredential

# Function: getPeerCredential()

> **getPeerCredential**(`fd`): [`PeerCredential`](../interfaces/PeerCredential.md)

Defined in: [packages/vehicle-server/src/unix-peer-cred.ts:66](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/unix-peer-cred.ts#L66)

`fd` is a raw Unix domain socket file descriptor, e.g. Bun's own
`socket.fd` on a connection accepted via `Bun.listen({ unix: path, ... })`
-- undocumented but the only accessor Bun currently exposes; guarded with
a runtime check here rather than trusted blindly at every call site.

## Parameters

### fd

`number`

## Returns

[`PeerCredential`](../interfaces/PeerCredential.md)
