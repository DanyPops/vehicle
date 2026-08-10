[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [daemon-lifecycle](../README.md) / DaemonLifecycleEvent

# Interface: DaemonLifecycleEvent

Defined in: [packages/vehicle-server/src/daemon-lifecycle.ts:30](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon-lifecycle.ts#L30)

## Properties

### at

> **at**: `string`

Defined in: [packages/vehicle-server/src/daemon-lifecycle.ts:36](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon-lifecycle.ts#L36)

ISO-8601 timestamp.

***

### correlationId?

> `optional` **correlationId?**: `string`

Defined in: [packages/vehicle-server/src/daemon-lifecycle.ts:41](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon-lifecycle.ts#L41)

Ties this event to whatever request/operation triggered it (see rpc-correlation.ts), when applicable.

***

### instanceId

> **instanceId**: `string`

Defined in: [packages/vehicle-server/src/daemon-lifecycle.ts:32](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon-lifecycle.ts#L32)

Minted once per daemon process start (a fresh randomUUID, not the PID) -- PID reuse across restarts is a real hazard this sidesteps.

***

### pid

> **pid**: `number`

Defined in: [packages/vehicle-server/src/daemon-lifecycle.ts:33](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon-lifecycle.ts#L33)

***

### provenance

> **provenance**: [`LaunchProvenance`](../../daemon/type-aliases/LaunchProvenance.md)

Defined in: [packages/vehicle-server/src/daemon-lifecycle.ts:37](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon-lifecycle.ts#L37)

***

### reason?

> `optional` **reason?**: `string`

Defined in: [packages/vehicle-server/src/daemon-lifecycle.ts:39](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon-lifecycle.ts#L39)

Shutdown reason ("SIGTERM", "SIGINT", "idle_budget_exceeded", "explicit", ...) or an already_running detail (e.g. the holder's pid) -- never a payload body.

***

### type

> **type**: [`DaemonLifecycleEventType`](../type-aliases/DaemonLifecycleEventType.md)

Defined in: [packages/vehicle-server/src/daemon-lifecycle.ts:34](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon-lifecycle.ts#L34)
