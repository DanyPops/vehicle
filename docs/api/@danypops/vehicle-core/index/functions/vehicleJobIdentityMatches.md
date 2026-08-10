[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / vehicleJobIdentityMatches

# Function: vehicleJobIdentityMatches()

> **vehicleJobIdentityMatches**(`recordInstanceToken`, `currentInstanceToken`): `boolean`

Defined in: [packages/vehicle-core/src/vehicle-jobs.ts:195](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-jobs.ts#L195)

Vehicle Jobs run as in-process promises, not child processes -- there is
no PID to reuse, but the same identity-confusion risk vstack's
{pid, startToken, comm} design guards against still applies in a
generalized form: a persisted job record written by one process
instance must never be mistaken for one this (possibly restarted)
instance can still resolve. Each VehicleJobStore construction gets a
fresh random instanceToken; a persisted record's own stamped token only
ever matches the instance that wrote it. A mismatch means "the original
run is gone", the same conclusion vstack's identityMatches() reaches by
comparing a live process's actual pid/start-time/command against a
stored snapshot -- this is that same check with no process to inspect.

## Parameters

### recordInstanceToken

`string`

### currentInstanceToken

`string`

## Returns

`boolean`
