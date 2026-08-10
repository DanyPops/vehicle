[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client](../../README.md) / [daemon-client](../README.md) / DaemonHandleLike

# Interface: DaemonHandleLike

Defined in: [packages/vehicle-client/src/daemon-client.ts:357](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L357)

The one field every consumer's daemon handle shares: enough to know a
daemon is reachable and build a client against it. Consumers pass their
own richer handle type through structurally -- this only declares what
connectWithPolicy itself needs to read.

## Properties

### host

> **host**: `string`

Defined in: [packages/vehicle-client/src/daemon-client.ts:358](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L358)

***

### pid

> **pid**: `number`

Defined in: [packages/vehicle-client/src/daemon-client.ts:360](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L360)

***

### port

> **port**: `number`

Defined in: [packages/vehicle-client/src/daemon-client.ts:359](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L359)
