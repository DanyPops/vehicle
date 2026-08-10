[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [vehicle-scheduler](../README.md) / VehicleScheduler

# Class: VehicleScheduler

Defined in: [packages/vehicle-server/src/vehicle-scheduler.ts:45](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-scheduler.ts#L45)

## Constructors

### Constructor

> **new VehicleScheduler**(`registry`, `options?`): `VehicleScheduler`

Defined in: [packages/vehicle-server/src/vehicle-scheduler.ts:55](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-scheduler.ts#L55)

#### Parameters

##### registry

[`VehicleRegistry`](../../vehicle-registry/classes/VehicleRegistry.md)

##### options?

[`VehicleSchedulerOptions`](../interfaces/VehicleSchedulerOptions.md) = `{}`

#### Returns

`VehicleScheduler`

## Methods

### cancel()

> **cancel**(`scheduleId`): `boolean`

Defined in: [packages/vehicle-server/src/vehicle-scheduler.ts:105](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-scheduler.ts#L105)

Idempotent-shaped -- returns false for an already-canceled or unknown id, matching WatchRegistry.remove()'s own "no error on a second call" convention.

#### Parameters

##### scheduleId

`string`

#### Returns

`boolean`

***

### list()

> **list**(`owner?`): readonly `VehicleScheduledEntry`[]

Defined in: [packages/vehicle-server/src/vehicle-scheduler.ts:114](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-scheduler.ts#L114)

#### Parameters

##### owner?

`string`

#### Returns

readonly `VehicleScheduledEntry`[]

***

### restore()

> **restore**(): `Promise`\<[`VehicleScheduleRestoreResult`](../interfaces/VehicleScheduleRestoreResult.md)\>

Defined in: [packages/vehicle-server/src/vehicle-scheduler.ts:72](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-scheduler.ts#L72)

Loads whatever this scheduler's persistence adapter has on disk and
re-arms a real timer for every entry -- call once at daemon startup,
before serving any request. A no-op if no persistence adapter was
configured, or nothing was ever saved.

#### Returns

`Promise`\<[`VehicleScheduleRestoreResult`](../interfaces/VehicleScheduleRestoreResult.md)\>

***

### schedule()

> **schedule**(`owner`, `trigger`, `action`): [`VehicleScheduleHandle`](../interfaces/VehicleScheduleHandle.md)

Defined in: [packages/vehicle-server/src/vehicle-scheduler.ts:86](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-scheduler.ts#L86)

#### Parameters

##### owner

`string`

##### trigger

`VehicleScheduleTrigger`

##### action

`VehicleScheduleAction`

#### Returns

[`VehicleScheduleHandle`](../interfaces/VehicleScheduleHandle.md)

***

### stop()

> **stop**(): `void`

Defined in: [packages/vehicle-server/src/vehicle-scheduler.ts:120](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-scheduler.ts#L120)

Clears every real timer without touching persisted state -- a clean process shutdown/test teardown, not a cancellation of the schedules themselves (restore() re-arms them next time this scheduler starts).

#### Returns

`void`
