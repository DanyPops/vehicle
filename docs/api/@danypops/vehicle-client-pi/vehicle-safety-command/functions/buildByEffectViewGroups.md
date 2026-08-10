[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-safety-command](../README.md) / buildByEffectViewGroups

# Function: buildByEffectViewGroups()

> **buildByEffectViewGroups**(`rows`): `object`[]

Defined in: [packages/vehicle-client-pi/src/vehicle-safety-command.ts:141](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety-command.ts#L141)

One group per effect value, insertion-ordered by first appearance. "ask" and "blocked" both render as "no" -- this view only distinguishes "can run with no gate at all" from everything else.

## Parameters

### rows

readonly [`VehicleSafetyRow`](../interfaces/VehicleSafetyRow.md)[]

## Returns

`object`[]
