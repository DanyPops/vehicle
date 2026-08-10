[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client](../../README.md) / [daemon-client](../README.md) / DaemonStatusOptions

# Interface: DaemonStatusOptions\<Handle, Client\>

Defined in: [packages/vehicle-client/src/daemon-client.ts:687](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L687)

## Type Parameters

### Handle

`Handle` *extends* [`DaemonHandleLike`](DaemonHandleLike.md)

### Client

`Client`

## Properties

### breaker?

> `optional` **breaker?**: () => [`CircuitBreakerState`](CircuitBreakerState.md)

Defined in: [packages/vehicle-client/src/daemon-client.ts:695](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L695)

Reports a createRetryingClient's breakerState() inline, so "why is nothing happening" and "is the breaker open" are answered by one call.

#### Returns

[`CircuitBreakerState`](CircuitBreakerState.md)

***

### buildClient

> **buildClient**: (`handle`) => `Client` \| `Promise`\<`Client`\>

Defined in: [packages/vehicle-client/src/daemon-client.ts:689](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L689)

#### Parameters

##### handle

`Handle`

#### Returns

`Client` \| `Promise`\<`Client`\>

***

### isPidAlive?

> `optional` **isPidAlive?**: (`pid`) => `boolean`

Defined in: [packages/vehicle-client/src/daemon-client.ts:697](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L697)

Defaults to process.kill(pid, 0)/EPERM-is-alive semantics. Injectable for tests.

#### Parameters

##### pid

`number`

#### Returns

`boolean`

***

### readHandle

> **readHandle**: () => `Handle` \| `null`

Defined in: [packages/vehicle-client/src/daemon-client.ts:688](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L688)

#### Returns

`Handle` \| `null`

***

### readVersion?

> `optional` **readVersion?**: (`client`) => `Promise`\<`string`\>

Defined in: [packages/vehicle-client/src/daemon-client.ts:691](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L691)

Optional -- e.g. reads the daemon's /health response. Omit to report liveness without a version.

#### Parameters

##### client

`Client`

#### Returns

`Promise`\<`string`\>

***

### startedAtMs?

> `optional` **startedAtMs?**: (`handle`) => `number` \| `undefined`

Defined in: [packages/vehicle-client/src/daemon-client.ts:693](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L693)

Optional -- computes uptime from whatever the handle/caller already tracks (this module does not itself define where a start timestamp lives).

#### Parameters

##### handle

`Handle`

#### Returns

`number` \| `undefined`
