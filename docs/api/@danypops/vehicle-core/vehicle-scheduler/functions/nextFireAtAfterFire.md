[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [vehicle-scheduler](../README.md) / nextFireAtAfterFire

# Function: nextFireAtAfterFire()

> **nextFireAtAfterFire**(`trigger`, `now`): `number` \| `undefined`

Defined in: [packages/vehicle-core/src/vehicle-scheduler.ts:59](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-scheduler.ts#L59)

The next fire time after a successful fire, or undefined if the entry (a one-shot "at") should be removed instead of re-armed.

## Parameters

### trigger

[`VehicleScheduleTrigger`](../type-aliases/VehicleScheduleTrigger.md)

### now

`number`

## Returns

`number` \| `undefined`
