[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client](../../README.md) / [daemon-client](../README.md) / CreateRetryingClientOptions

# Interface: CreateRetryingClientOptions

Defined in: [packages/vehicle-client/src/daemon-client.ts:159](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L159)

## Properties

### circuitBreaker?

> `optional` **circuitBreaker?**: `false` \| [`CircuitBreakerOptions`](CircuitBreakerOptions.md)

Defined in: [packages/vehicle-client/src/daemon-client.ts:175](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L175)

Fail-fast policy against a connect() that keeps failing. Pass `false` to
disable entirely (unthrottled retry on every call(), the pre-existing
behavior). Defaults to enabled with failureThreshold: 3, cooldownMs: 10_000.

***

### isPreDispatchConnectionError?

> `optional` **isPreDispatchConnectionError?**: [`StaleConnectionPredicate`](../type-aliases/StaleConnectionPredicate.md)

Defined in: [packages/vehicle-client/src/daemon-client.ts:163](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L163)

Defaults to the deliberately conservative isDefinitelyPreDispatchConnectionError.

***

### isStaleConnectionError?

> `optional` **isStaleConnectionError?**: [`StaleConnectionPredicate`](../type-aliases/StaleConnectionPredicate.md)

Defined in: [packages/vehicle-client/src/daemon-client.ts:161](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L161)

Defaults to isLikelyStaleConnectionError.

***

### label?

> `optional` **label?**: `string`

Defined in: [packages/vehicle-client/src/daemon-client.ts:169](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L169)

Used only in the retry-exhausted error message, e.g. "Lector".

***

### onIdentityChange?

> `optional` **onIdentityChange?**: (`change`) => `void` \| `Promise`\<`void`\>

Defined in: [packages/vehicle-client/src/daemon-client.ts:167](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L167)

Called after identity-triggered invalidation so consumers can clear process-local registrations.

#### Parameters

##### change

[`DaemonIdentityChange`](DaemonIdentityChange.md)

#### Returns

`void` \| `Promise`\<`void`\>

***

### resolveIdentity?

> `optional` **resolveIdentity?**: () => [`DaemonInstanceIdentity`](../type-aliases/DaemonInstanceIdentity.md) \| `Promise`\<[`DaemonInstanceIdentity`](../type-aliases/DaemonInstanceIdentity.md)\>

Defined in: [packages/vehicle-client/src/daemon-client.ts:165](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L165)

Re-resolved before every dispatch; a changed value invalidates the cached client before the operation runs.

#### Returns

[`DaemonInstanceIdentity`](../type-aliases/DaemonInstanceIdentity.md) \| `Promise`\<[`DaemonInstanceIdentity`](../type-aliases/DaemonInstanceIdentity.md)\>
