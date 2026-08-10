[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [vehicle-job-persistence](../README.md) / CreateFileVehicleJobPersistenceOptions

# Interface: CreateFileVehicleJobPersistenceOptions

Defined in: [packages/vehicle-server/src/vehicle-job-persistence.ts:80](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-persistence.ts#L80)

## Properties

### filePath

> `readonly` **filePath**: `string`

Defined in: [packages/vehicle-server/src/vehicle-job-persistence.ts:81](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-persistence.ts#L81)

***

### fs

> `readonly` **fs**: `AtomicJsonFsAdapter`

Defined in: [packages/vehicle-server/src/vehicle-job-persistence.ts:82](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-persistence.ts#L82)

***

### onCorruptSnapshot?

> `readonly` `optional` **onCorruptSnapshot?**: (`raw`) => `void`

Defined in: [packages/vehicle-server/src/vehicle-job-persistence.ts:84](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-persistence.ts#L84)

Called with whatever malformed value was found on disk, right before it's discarded in favor of an empty restore. Optional -- a caller with no logger just loses the diagnostic, not correctness.

#### Parameters

##### raw

`unknown`

#### Returns

`void`
