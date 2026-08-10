[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [vehicle-scheduler](../README.md) / nextFireAtAfterRestore

# Function: nextFireAtAfterRestore()

> **nextFireAtAfterRestore**(`trigger`, `persistedNextFireAt`, `now`): `number`

Defined in: [packages/vehicle-core/src/vehicle-scheduler.ts:70](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-scheduler.ts#L70)

Where a restored entry should be re-armed to. A one-shot "at" entry keeps
its original persisted time (fires as soon as possible if overdue -- the
one thing it was supposed to do must not be silently lost). A recurring
"every" entry resumes its normal cadence from now if it fell behind while
the daemon was down, rather than firing once per missed tick.

## Parameters

### trigger

[`VehicleScheduleTrigger`](../type-aliases/VehicleScheduleTrigger.md)

### persistedNextFireAt

`number`

### now

`number`

## Returns

`number`
