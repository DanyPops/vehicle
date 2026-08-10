[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client](../../README.md) / [daemon-client](../README.md) / CircuitBreakerState

# Interface: CircuitBreakerState

Defined in: [packages/vehicle-client/src/daemon-client.ts:120](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L120)

## Properties

### consecutiveFailures

> **consecutiveFailures**: `number`

Defined in: [packages/vehicle-client/src/daemon-client.ts:123](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L123)

***

### open

> **open**: `boolean`

Defined in: [packages/vehicle-client/src/daemon-client.ts:122](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L122)

True when call() is currently short-circuiting instead of attempting a real connect.

***

### openedAt

> **openedAt**: `number` \| `null`

Defined in: [packages/vehicle-client/src/daemon-client.ts:125](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L125)

Epoch ms the breaker last opened, or null if it has never opened (or was reset).
