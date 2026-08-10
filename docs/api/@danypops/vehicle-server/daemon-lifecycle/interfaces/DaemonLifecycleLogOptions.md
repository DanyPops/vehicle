[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [daemon-lifecycle](../README.md) / DaemonLifecycleLogOptions

# Interface: DaemonLifecycleLogOptions

Defined in: [packages/vehicle-server/src/daemon-lifecycle.ts:54](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon-lifecycle.ts#L54)

## Properties

### fs

> **fs**: `AtomicJsonFsAdapter`

Defined in: [packages/vehicle-server/src/daemon-lifecycle.ts:56](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon-lifecycle.ts#L56)

***

### maxEvents?

> `optional` **maxEvents?**: `number`

Defined in: [packages/vehicle-server/src/daemon-lifecycle.ts:60](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon-lifecycle.ts#L60)

Defaults to DAEMON_LIFECYCLE_MAX_EVENTS.

***

### now?

> `optional` **now?**: () => `string`

Defined in: [packages/vehicle-server/src/daemon-lifecycle.ts:58](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon-lifecycle.ts#L58)

Defaults to `() => new Date().toISOString()`. Injectable for deterministic tests.

#### Returns

`string`

***

### path

> **path**: `string`

Defined in: [packages/vehicle-server/src/daemon-lifecycle.ts:55](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon-lifecycle.ts#L55)
