[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client](../../README.md) / [daemon-client](../README.md) / DaemonStatus

# Interface: DaemonStatus

Defined in: [packages/vehicle-client/src/daemon-client.ts:675](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L675)

## Properties

### breaker?

> `optional` **breaker?**: [`CircuitBreakerState`](CircuitBreakerState.md)

Defined in: [packages/vehicle-client/src/daemon-client.ts:680](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L680)

***

### lastError?

> `optional` **lastError?**: `string`

Defined in: [packages/vehicle-client/src/daemon-client.ts:682](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L682)

Set only for state "unreachable" -- the error the connect/version-read attempt raised.

***

### pid?

> `optional` **pid?**: `number`

Defined in: [packages/vehicle-client/src/daemon-client.ts:677](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L677)

***

### state

> **state**: [`DaemonStatusState`](../type-aliases/DaemonStatusState.md)

Defined in: [packages/vehicle-client/src/daemon-client.ts:676](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L676)

***

### summary

> **summary**: `string`

Defined in: [packages/vehicle-client/src/daemon-client.ts:684](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L684)

One human-readable line, safe to print as-is; every other field is the machine-readable detail behind it.

***

### uptimeMs?

> `optional` **uptimeMs?**: `number`

Defined in: [packages/vehicle-client/src/daemon-client.ts:679](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L679)

***

### version?

> `optional` **version?**: `string`

Defined in: [packages/vehicle-client/src/daemon-client.ts:678](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L678)
