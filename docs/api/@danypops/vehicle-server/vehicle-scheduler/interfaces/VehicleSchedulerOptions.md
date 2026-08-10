[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [vehicle-scheduler](../README.md) / VehicleSchedulerOptions

# Interface: VehicleSchedulerOptions

Defined in: [packages/vehicle-server/src/vehicle-scheduler.ts:26](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-scheduler.ts#L26)

## Properties

### maxSchedulesPerOwner?

> `readonly` `optional` **maxSchedulesPerOwner?**: `number`

Defined in: [packages/vehicle-server/src/vehicle-scheduler.ts:30](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-scheduler.ts#L30)

Defaults to DEFAULT_MAX_SCHEDULES_PER_OWNER.

***

### now?

> `readonly` `optional` **now?**: () => `number`

Defined in: [packages/vehicle-server/src/vehicle-scheduler.ts:27](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-scheduler.ts#L27)

#### Returns

`number`

***

### onFireError?

> `readonly` `optional` **onFireError?**: (`entry`, `error`) => `void`

Defined in: [packages/vehicle-server/src/vehicle-scheduler.ts:33](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-scheduler.ts#L33)

A fired operation/event action that itself throws is reported here and otherwise swallowed -- one bad fire must never stop the scheduler or crash the daemon.

#### Parameters

##### entry

`VehicleScheduledEntry`

##### error

`unknown`

#### Returns

`void`

***

### onPersistError?

> `readonly` `optional` **onPersistError?**: (`error`) => `void`

Defined in: [packages/vehicle-server/src/vehicle-scheduler.ts:31](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-scheduler.ts#L31)

#### Parameters

##### error

`unknown`

#### Returns

`void`

***

### persistence?

> `readonly` `optional` **persistence?**: [`VehicleSchedulePersistenceAdapter`](../../vehicle-schedule-persistence/interfaces/VehicleSchedulePersistenceAdapter.md)

Defined in: [packages/vehicle-server/src/vehicle-scheduler.ts:28](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-scheduler.ts#L28)
