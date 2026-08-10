[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [vehicle-job-persistence](../README.md) / VehicleJobPersistenceAdapter

# Interface: VehicleJobPersistenceAdapter

Defined in: [packages/vehicle-server/src/vehicle-job-persistence.ts:40](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-persistence.ts#L40)

## Methods

### load()

> **load**(): `Promise`\<[`VehicleJobPersistedSnapshot`](VehicleJobPersistedSnapshot.md) \| `undefined`\>

Defined in: [packages/vehicle-server/src/vehicle-job-persistence.ts:43](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-persistence.ts#L43)

Returns undefined if there's nothing to restore, or what's on disk doesn't look like a real snapshot -- never throws for a corrupt/foreign file.

#### Returns

`Promise`\<[`VehicleJobPersistedSnapshot`](VehicleJobPersistedSnapshot.md) \| `undefined`\>

***

### save()

> **save**(`snapshot`): `Promise`\<`void`\>

Defined in: [packages/vehicle-server/src/vehicle-job-persistence.ts:41](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-persistence.ts#L41)

#### Parameters

##### snapshot

[`VehicleJobPersistedSnapshot`](VehicleJobPersistedSnapshot.md)

#### Returns

`Promise`\<`void`\>
