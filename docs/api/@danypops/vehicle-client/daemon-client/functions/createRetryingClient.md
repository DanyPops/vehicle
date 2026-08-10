[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client](../../README.md) / [daemon-client](../README.md) / createRetryingClient

# Function: createRetryingClient()

> **createRetryingClient**\<`Client`\>(`connect`, `options?`): [`RetryingClient`](../interfaces/RetryingClient.md)\<`Client`\>

Defined in: [packages/vehicle-client/src/daemon-client.ts:242](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L242)

Wraps `connect` (typically a function that reads a daemon's handle file,
loads its auth token, and constructs an RPC client) with the caching and
retry policy every one of this house's Pi extensions already needed. A
failed connection attempt is never cached, so the very next call retries
once the daemon is actually reachable.

## Type Parameters

### Client

`Client`

## Parameters

### connect

() => `Promise`\<`Client`\>

### options?

[`CreateRetryingClientOptions`](../interfaces/CreateRetryingClientOptions.md) = `{}`

## Returns

[`RetryingClient`](../interfaces/RetryingClient.md)\<`Client`\>
