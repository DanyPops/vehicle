[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client](../../README.md) / [daemon-client](../README.md) / ConnectVersionCheckRetryOptions

# Interface: ConnectVersionCheckRetryOptions

Defined in: [packages/vehicle-client/src/daemon-client.ts:469](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L469)

## Properties

### attempts?

> `readonly` `optional` **attempts?**: `number`

Defined in: [packages/vehicle-client/src/daemon-client.ts:471](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L471)

Total attempts at the connect+readVersion round trip, including the first. Defaults to 4.

***

### growFactor?

> `readonly` `optional` **growFactor?**: `number`

Defined in: [packages/vehicle-client/src/daemon-client.ts:477](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L477)

Multiplier applied to the delay after each failed attempt. Defaults to 2.5.

***

### initialDelayMs?

> `readonly` `optional` **initialDelayMs?**: `number`

Defined in: [packages/vehicle-client/src/daemon-client.ts:473](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L473)

Delay before the second attempt. Defaults to 50ms.

***

### maxDelayMs?

> `readonly` `optional` **maxDelayMs?**: `number`

Defined in: [packages/vehicle-client/src/daemon-client.ts:475](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L475)

No retry delay is ever allowed to exceed this. Defaults to 500ms.
