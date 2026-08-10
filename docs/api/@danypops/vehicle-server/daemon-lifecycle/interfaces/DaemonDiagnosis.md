[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [daemon-lifecycle](../README.md) / DaemonDiagnosis

# Interface: DaemonDiagnosis

Defined in: [packages/vehicle-server/src/daemon-lifecycle.ts:117](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon-lifecycle.ts#L117)

## Extends

- [`DaemonIdentity`](DaemonIdentity.md)

## Properties

### history

> **history**: [`DaemonLifecycleEvent`](DaemonLifecycleEvent.md)[]

Defined in: [packages/vehicle-server/src/daemon-lifecycle.ts:119](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon-lifecycle.ts#L119)

Most-recent-last, bounded by historyLimit (or the log's own retention bound).

***

### instanceId

> **instanceId**: `string`

Defined in: [packages/vehicle-server/src/daemon-lifecycle.ts:110](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon-lifecycle.ts#L110)

#### Inherited from

[`DaemonIdentity`](DaemonIdentity.md).[`instanceId`](DaemonIdentity.md#instanceid)

***

### pid

> **pid**: `number`

Defined in: [packages/vehicle-server/src/daemon-lifecycle.ts:111](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon-lifecycle.ts#L111)

#### Inherited from

[`DaemonIdentity`](DaemonIdentity.md).[`pid`](DaemonIdentity.md#pid)

***

### provenance

> **provenance**: [`LaunchProvenance`](../../daemon/type-aliases/LaunchProvenance.md)

Defined in: [packages/vehicle-server/src/daemon-lifecycle.ts:114](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon-lifecycle.ts#L114)

#### Inherited from

[`DaemonIdentity`](DaemonIdentity.md).[`provenance`](DaemonIdentity.md#provenance)

***

### startedAt

> **startedAt**: `string`

Defined in: [packages/vehicle-server/src/daemon-lifecycle.ts:113](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon-lifecycle.ts#L113)

ISO-8601 timestamp this instance actually came up.

#### Inherited from

[`DaemonIdentity`](DaemonIdentity.md).[`startedAt`](DaemonIdentity.md#startedat)
