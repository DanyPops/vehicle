[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [vehicle-schedule-persistence](../README.md) / VehicleSchedulePersistenceAdapter

# Interface: VehicleSchedulePersistenceAdapter

Defined in: [packages/vehicle-server/src/vehicle-schedule-persistence.ts:19](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-schedule-persistence.ts#L19)

## Methods

### load()

> **load**(): `Promise`\<[`VehicleSchedulePersistedSnapshot`](VehicleSchedulePersistedSnapshot.md) \| `undefined`\>

Defined in: [packages/vehicle-server/src/vehicle-schedule-persistence.ts:22](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-schedule-persistence.ts#L22)

Returns undefined if there's nothing to restore, or what's on disk doesn't look like a real snapshot -- never throws for a corrupt/foreign file.

#### Returns

`Promise`\<[`VehicleSchedulePersistedSnapshot`](VehicleSchedulePersistedSnapshot.md) \| `undefined`\>

***

### save()

> **save**(`snapshot`): `Promise`\<`void`\>

Defined in: [packages/vehicle-server/src/vehicle-schedule-persistence.ts:20](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-schedule-persistence.ts#L20)

#### Parameters

##### snapshot

[`VehicleSchedulePersistedSnapshot`](VehicleSchedulePersistedSnapshot.md)

#### Returns

`Promise`\<`void`\>
