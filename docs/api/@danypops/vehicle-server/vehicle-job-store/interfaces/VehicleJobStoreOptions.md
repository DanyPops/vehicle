[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [vehicle-job-store](../README.md) / VehicleJobStoreOptions

# Interface: VehicleJobStoreOptions

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:59](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L59)

## Properties

### deliveredRetentionMs?

> `readonly` `optional` **deliveredRetentionMs?**: `number`

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:67](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L67)

How long a delivered terminal job is kept before becoming eviction-eligible. Defaults to 24h.

***

### maxRetainedJobs?

> `readonly` `optional` **maxRetainedJobs?**: `number`

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:65](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L65)

Hard cap on total retained job records; a running job is never a candidate. Defaults to 1000.

***

### maxSteerQueueSize?

> `readonly` `optional` **maxSteerQueueSize?**: `number`

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:69](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L69)

Bounds a job's own steer-input buffer. Defaults to 64.

***

### now?

> `readonly` `optional` **now?**: () => `number`

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:61](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L61)

Defaults to Date.now.

#### Returns

`number`

***

### onPersistError?

> `readonly` `optional` **onPersistError?**: (`error`) => `void`

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:71](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L71)

Persistence is best-effort: a write failure (e.g. disk full) must never break a job's own execution. Defaults to a no-op.

#### Parameters

##### error

`unknown`

#### Returns

`void`

***

### persistence?

> `readonly` `optional` **persistence?**: [`VehicleJobPersistenceAdapter`](../../vehicle-job-persistence/interfaces/VehicleJobPersistenceAdapter.md)

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:63](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L63)

Omit for a pure in-memory store (the walking skeleton's original behavior) -- restore()/persistence are then both no-ops.
