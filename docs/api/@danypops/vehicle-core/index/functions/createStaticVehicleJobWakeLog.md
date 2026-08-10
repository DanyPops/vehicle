[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / createStaticVehicleJobWakeLog

# Function: createStaticVehicleJobWakeLog()

> **createStaticVehicleJobWakeLog**(`entries`): [`VehicleJobWakeLogReader`](../interfaces/VehicleJobWakeLogReader.md)

Defined in: [packages/vehicle-core/src/vehicle-jobs.ts:123](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-jobs.ts#L123)

Wraps a fixed, already-finalized list of entries (e.g. restored from disk) in the same reader shape a live VehicleJobWakeLog exposes, so VehicleJobStore.tail() doesn't need to special-case a restored job.

## Parameters

### entries

readonly [`VehicleJobWakeEntry`](../interfaces/VehicleJobWakeEntry.md)[]

## Returns

[`VehicleJobWakeLogReader`](../interfaces/VehicleJobWakeLogReader.md)
