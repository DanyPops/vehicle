[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / selectVehicleJobsForEviction

# Function: selectVehicleJobsForEviction()

> **selectVehicleJobsForEviction**(`candidates`, `options`): readonly `string`[]

Defined in: [packages/vehicle-core/src/vehicle-jobs.ts:225](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-jobs.ts#L225)

Pure eviction-selection policy, kept separate from VehicleJobStore's own
bookkeeping so the bounded-retention rule is independently testable.
Preference order: (1) delivered and past deliveredRetentionMs, oldest
first; (2) once still over maxRetainedJobs, any delivered terminal job,
oldest first; (3) only as a last resort, an undelivered terminal job,
oldest first -- a real loss (a caller may still want that result), but
an unbounded store is a worse failure mode. A running job is never a
candidate.

## Parameters

### candidates

readonly [`VehicleJobEvictionCandidate`](../interfaces/VehicleJobEvictionCandidate.md)[]

### options

[`VehicleJobRetentionOptions`](../interfaces/VehicleJobRetentionOptions.md)

## Returns

readonly `string`[]
