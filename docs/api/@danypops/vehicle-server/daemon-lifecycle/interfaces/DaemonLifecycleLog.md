[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [daemon-lifecycle](../README.md) / DaemonLifecycleLog

# Interface: DaemonLifecycleLog

Defined in: [packages/vehicle-server/src/daemon-lifecycle.ts:47](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon-lifecycle.ts#L47)

## Methods

### recent()

> **recent**(`limit?`): `Promise`\<[`DaemonLifecycleEvent`](DaemonLifecycleEvent.md)[]\>

Defined in: [packages/vehicle-server/src/daemon-lifecycle.ts:51](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon-lifecycle.ts#L51)

Most-recent-last. Bounded to `limit` (defaulting to every retained event) -- never unbounded.

#### Parameters

##### limit?

`number`

#### Returns

`Promise`\<[`DaemonLifecycleEvent`](DaemonLifecycleEvent.md)[]\>

***

### record()

> **record**(`event`): `Promise`\<[`DaemonLifecycleEvent`](DaemonLifecycleEvent.md)\>

Defined in: [packages/vehicle-server/src/daemon-lifecycle.ts:49](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon-lifecycle.ts#L49)

Appends one event (with a fresh timestamp) and persists it, trimming to the oldest-dropped-first bound. Returns the fully-populated event actually recorded.

#### Parameters

##### event

`Omit`\<[`DaemonLifecycleEvent`](DaemonLifecycleEvent.md), `"at"`\>

#### Returns

`Promise`\<[`DaemonLifecycleEvent`](DaemonLifecycleEvent.md)\>
