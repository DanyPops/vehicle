[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / VehicleJobEvictionCandidate

# Interface: VehicleJobEvictionCandidate

Defined in: [packages/vehicle-core/src/vehicle-jobs.ts:200](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-jobs.ts#L200)

Minimal shape selectVehicleJobsForEviction needs from a job record -- kept separate from VehicleJobSnapshot so vehicle-server doesn't have to construct a full snapshot just to ask "should this be swept".

## Properties

### delivered

> `readonly` **delivered**: `boolean`

Defined in: [packages/vehicle-core/src/vehicle-jobs.ts:203](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-jobs.ts#L203)

***

### jobId

> `readonly` **jobId**: `string`

Defined in: [packages/vehicle-core/src/vehicle-jobs.ts:201](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-jobs.ts#L201)

***

### status

> `readonly` **status**: [`VehicleJobStatus`](../type-aliases/VehicleJobStatus.md)

Defined in: [packages/vehicle-core/src/vehicle-jobs.ts:202](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-jobs.ts#L202)

***

### updatedAt

> `readonly` **updatedAt**: `number`

Defined in: [packages/vehicle-core/src/vehicle-jobs.ts:204](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-jobs.ts#L204)
