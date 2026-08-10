[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client](../../README.md) / [daemon-client](../README.md) / RetryingClient

# Interface: RetryingClient\<Client\>

Defined in: [packages/vehicle-client/src/daemon-client.ts:128](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L128)

## Type Parameters

### Client

`Client`

## Methods

### breakerState()

> **breakerState**(): [`CircuitBreakerState`](CircuitBreakerState.md)

Defined in: [packages/vehicle-client/src/daemon-client.ts:156](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L156)

Current breaker state, readable without triggering a live connect attempt.

#### Returns

[`CircuitBreakerState`](CircuitBreakerState.md)

***

### call()

> **call**\<`T`\>(`operation`): `Promise`\<`T`\>

Defined in: [packages/vehicle-client/src/daemon-client.ts:142](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L142)

Runs `operation` against a connected client. On a stale-connection
error, drops the cached client and retries `operation` exactly once
against a freshly reconnected one; any other error, or a second
consecutive failure, propagates immediately.

When the circuit breaker is open (see CircuitBreakerOptions), call()
rejects immediately with the last connect failure instead of attempting
a new connect -- a daemon that is fundamentally broken (crash-loops,
corrupt state, missing runtime dependency) would otherwise cost every
single call() the full connect timeout before failing, repeatedly, for
the rest of the session.

#### Type Parameters

##### T

`T`

#### Parameters

##### operation

(`client`) => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>

***

### callOnce()

> **callOnce**\<`T`\>(`operation`, `options?`): `Promise`\<`T`\>

Defined in: [packages/vehicle-client/src/daemon-client.ts:152](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L152)

Like call(), but never retries `operation` itself after a failure --
only the underlying connection is dropped (when the failure looks
connection-shaped) so the *next* call()/callOnce() reconnects. Use this
for a mutating/non-idempotent operation where transparently re-running
it a second time after a transport failure could cause a duplicate
side effect (e.g. Vehicle's own invoke()); call() remains right for a
read-only or genuinely idempotent operation.

#### Type Parameters

##### T

`T`

#### Parameters

##### operation

(`client`) => `Promise`\<`T`\>

##### options?

[`CallOnceOptions`](CallOnceOptions.md)

#### Returns

`Promise`\<`T`\>

***

### reset()

> **reset**(): `void`

Defined in: [packages/vehicle-client/src/daemon-client.ts:154](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L154)

Drops any cached client and resets the circuit breaker, forcing the next call() to reconnect.

#### Returns

`void`
