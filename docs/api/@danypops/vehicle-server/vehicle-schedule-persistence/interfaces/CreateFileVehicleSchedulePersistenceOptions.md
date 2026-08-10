[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [vehicle-schedule-persistence](../README.md) / CreateFileVehicleSchedulePersistenceOptions

# Interface: CreateFileVehicleSchedulePersistenceOptions

Defined in: [packages/vehicle-server/src/vehicle-schedule-persistence.ts:66](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-schedule-persistence.ts#L66)

## Properties

### filePath

> `readonly` **filePath**: `string`

Defined in: [packages/vehicle-server/src/vehicle-schedule-persistence.ts:67](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-schedule-persistence.ts#L67)

***

### fs

> `readonly` **fs**: `AtomicJsonFsAdapter`

Defined in: [packages/vehicle-server/src/vehicle-schedule-persistence.ts:68](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-schedule-persistence.ts#L68)

***

### onCorruptSnapshot?

> `readonly` `optional` **onCorruptSnapshot?**: (`raw`) => `void`

Defined in: [packages/vehicle-server/src/vehicle-schedule-persistence.ts:70](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-schedule-persistence.ts#L70)

Called with whatever malformed value was found on disk, right before it's discarded in favor of an empty restore. Optional -- a caller with no logger just loses the diagnostic, not correctness.

#### Parameters

##### raw

`unknown`

#### Returns

`void`
