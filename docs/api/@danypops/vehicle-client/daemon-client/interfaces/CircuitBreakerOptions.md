[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client](../../README.md) / [daemon-client](../README.md) / CircuitBreakerOptions

# Interface: CircuitBreakerOptions

Defined in: [packages/vehicle-client/src/daemon-client.ts:178](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L178)

## Properties

### cooldownMs?

> `optional` **cooldownMs?**: `number`

Defined in: [packages/vehicle-client/src/daemon-client.ts:182](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L182)

How long the breaker stays open before allowing one probe attempt through. Defaults to 10_000ms.

***

### failureThreshold?

> `optional` **failureThreshold?**: `number`

Defined in: [packages/vehicle-client/src/daemon-client.ts:180](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L180)

Consecutive connect() failures before call() starts short-circuiting. Defaults to 3.
