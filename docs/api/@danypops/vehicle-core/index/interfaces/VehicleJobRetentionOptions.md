[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / VehicleJobRetentionOptions

# Interface: VehicleJobRetentionOptions

Defined in: [packages/vehicle-core/src/vehicle-jobs.ts:207](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-jobs.ts#L207)

## Properties

### deliveredRetentionMs

> `readonly` **deliveredRetentionMs**: `number`

Defined in: [packages/vehicle-core/src/vehicle-jobs.ts:211](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-jobs.ts#L211)

A delivered terminal job becomes eligible for eviction once this many ms have passed since it was delivered (== updatedAt at delivery time).

***

### maxRetainedJobs

> `readonly` **maxRetainedJobs**: `number`

Defined in: [packages/vehicle-core/src/vehicle-jobs.ts:209](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-jobs.ts#L209)

Hard cap on total retained job records (of any status). A running job is never evicted regardless of this cap.

***

### now

> `readonly` **now**: `number`

Defined in: [packages/vehicle-core/src/vehicle-jobs.ts:212](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-jobs.ts#L212)
