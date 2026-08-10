[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [vehicle-scheduler](../README.md) / VehicleScheduledEntry

# Interface: VehicleScheduledEntry

Defined in: [packages/vehicle-core/src/vehicle-scheduler.ts:29](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-scheduler.ts#L29)

## Properties

### action

> `readonly` **action**: [`VehicleScheduleAction`](../type-aliases/VehicleScheduleAction.md)

Defined in: [packages/vehicle-core/src/vehicle-scheduler.ts:33](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-scheduler.ts#L33)

***

### createdAt

> `readonly` **createdAt**: `number`

Defined in: [packages/vehicle-core/src/vehicle-scheduler.ts:34](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-scheduler.ts#L34)

***

### nextFireAt

> `readonly` **nextFireAt**: `number`

Defined in: [packages/vehicle-core/src/vehicle-scheduler.ts:36](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-scheduler.ts#L36)

For "at": consumed once it fires. For "every": advanced to the next tick after each fire.

***

### owner

> `readonly` **owner**: `string`

Defined in: [packages/vehicle-core/src/vehicle-scheduler.ts:31](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-scheduler.ts#L31)

***

### scheduleId

> `readonly` **scheduleId**: `string`

Defined in: [packages/vehicle-core/src/vehicle-scheduler.ts:30](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-scheduler.ts#L30)

***

### trigger

> `readonly` **trigger**: [`VehicleScheduleTrigger`](../type-aliases/VehicleScheduleTrigger.md)

Defined in: [packages/vehicle-core/src/vehicle-scheduler.ts:32](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-scheduler.ts#L32)
