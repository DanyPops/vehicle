[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-safety](../README.md) / CreateFileVehicleSafetyPersistenceOptions

# Interface: CreateFileVehicleSafetyPersistenceOptions

Defined in: [packages/vehicle-client-pi/src/vehicle-safety.ts:82](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety.ts#L82)

## Properties

### filePath

> `readonly` **filePath**: `string`

Defined in: [packages/vehicle-client-pi/src/vehicle-safety.ts:83](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety.ts#L83)

***

### fs

> `readonly` **fs**: `AtomicJsonFsAdapter`

Defined in: [packages/vehicle-client-pi/src/vehicle-safety.ts:84](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety.ts#L84)

***

### onCorruptSnapshot?

> `readonly` `optional` **onCorruptSnapshot?**: (`raw`) => `void`

Defined in: [packages/vehicle-client-pi/src/vehicle-safety.ts:86](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety.ts#L86)

Called with whatever malformed value was found on disk, right before it's discarded in favor of an empty restore.

#### Parameters

##### raw

`unknown`

#### Returns

`void`
