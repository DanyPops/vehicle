[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [unix-rpc-server](../README.md) / UnixRpcServerOptions

# Interface: UnixRpcServerOptions

Defined in: [packages/vehicle-server/src/unix-rpc-server.ts:34](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/unix-rpc-server.ts#L34)

## Properties

### handler

> **handler**: (`request`, `peer`) => `Promise`\<`Response`\>

Defined in: [packages/vehicle-server/src/unix-rpc-server.ts:38](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/unix-rpc-server.ts#L38)

#### Parameters

##### request

`Request`

##### peer

[`PeerCredential`](../../unix-peer-cred/interfaces/PeerCredential.md)

#### Returns

`Promise`\<`Response`\>

***

### mode?

> `optional` **mode?**: `number`

Defined in: [packages/vehicle-server/src/unix-rpc-server.ts:37](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/unix-rpc-server.ts#L37)

Mode for the created socket file; defaults to 0600 (owner-only), matching this package's other owner-only-by-default surfaces.

***

### onError?

> `optional` **onError?**: (`err`) => `void`

Defined in: [packages/vehicle-server/src/unix-rpc-server.ts:40](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/unix-rpc-server.ts#L40)

Called for a genuinely unexpected failure (peer-cred lookup failing, a handler throwing); never silently swallowed.

#### Parameters

##### err

`unknown`

#### Returns

`void`

***

### path

> **path**: `string`

Defined in: [packages/vehicle-server/src/unix-rpc-server.ts:35](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/unix-rpc-server.ts#L35)
