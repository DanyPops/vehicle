[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / VehicleJobWakeLogOptions

# Interface: VehicleJobWakeLogOptions

Defined in: [packages/vehicle-core/src/vehicle-jobs.ts:43](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-jobs.ts#L43)

## Properties

### budget

> `readonly` **budget**: [`VehicleJobWakeBudget`](VehicleJobWakeBudget.md)

Defined in: [packages/vehicle-core/src/vehicle-jobs.ts:45](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-jobs.ts#L45)

***

### notifyMode

> `readonly` **notifyMode**: [`VehicleJobNotifyMode`](../type-aliases/VehicleJobNotifyMode.md)

Defined in: [packages/vehicle-core/src/vehicle-jobs.ts:44](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-jobs.ts#L44)

***

### now?

> `readonly` `optional` **now?**: () => `number`

Defined in: [packages/vehicle-core/src/vehicle-jobs.ts:47](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-jobs.ts#L47)

Defaults to Date.now.

#### Returns

`number`
