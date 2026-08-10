[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client](../../README.md) / [unix-rpc-client](../README.md) / UnixRpcClientOptions

# Interface: UnixRpcClientOptions

Defined in: [packages/vehicle-client/src/unix-rpc-client.ts:28](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/unix-rpc-client.ts#L28)

## Properties

### path

> **path**: `string`

Defined in: [packages/vehicle-client/src/unix-rpc-client.ts:29](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/unix-rpc-client.ts#L29)

***

### timeoutMs?

> `optional` **timeoutMs?**: `number`

Defined in: [packages/vehicle-client/src/unix-rpc-client.ts:31](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/unix-rpc-client.ts#L31)

A hung or dead server should never block a caller forever. Default 5000ms.
