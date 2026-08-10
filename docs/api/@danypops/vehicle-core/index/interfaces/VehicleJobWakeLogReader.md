[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / VehicleJobWakeLogReader

# Interface: VehicleJobWakeLogReader

Defined in: [packages/vehicle-core/src/vehicle-jobs.ts:117](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-jobs.ts#L117)

Read-only replay side of a wake log -- both a live VehicleJobWakeLog and a restored (no-longer-appendable) job satisfy this with the same tail() semantics.

## Properties

### cursor

> `readonly` **cursor**: `number`

Defined in: [packages/vehicle-core/src/vehicle-jobs.ts:119](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-jobs.ts#L119)

## Methods

### since()

> **since**(`cursor`): readonly [`VehicleJobWakeEntry`](VehicleJobWakeEntry.md)[]

Defined in: [packages/vehicle-core/src/vehicle-jobs.ts:118](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-jobs.ts#L118)

#### Parameters

##### cursor

`number`

#### Returns

readonly [`VehicleJobWakeEntry`](VehicleJobWakeEntry.md)[]
