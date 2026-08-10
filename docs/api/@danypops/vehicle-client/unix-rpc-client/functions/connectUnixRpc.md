[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client](../../README.md) / [unix-rpc-client](../README.md) / connectUnixRpc

# Function: connectUnixRpc()

> **connectUnixRpc**(`options`): (`request`) => `Promise`\<`Response`\>

Defined in: [packages/vehicle-client/src/unix-rpc-client.ts:56](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/unix-rpc-client.ts#L56)

Builds a `(request: Request) => Promise<Response>` transport that sends
one request over a fresh connection to `path` and resolves with the
server's one response, then closes -- matching serveUnixRpc's own
one-request-per-connection contract (no keep-alive, no pipelining).

## Parameters

### options

[`UnixRpcClientOptions`](../interfaces/UnixRpcClientOptions.md)

## Returns

(`request`) => `Promise`\<`Response`\>
