[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [supervisor](../README.md) / awaitGracefulShutdown

# Function: awaitGracefulShutdown()

> **awaitGracefulShutdown**(`onShutdown`): `void`

Defined in: [packages/vehicle-server/src/supervisor.ts:98](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/supervisor.ts#L98)

Counterpart to requestGracefulShutdown(): a unit spawned via spawnUnit()
calls this once at startup to be notified the same way whether it was
asked to stop via a real SIGINT/SIGTERM (POSIX) or the stdin fallback
(Windows) -- so the unit itself never needs its own platform branch.
Reads process.stdin directly (a standard Node API, implemented the same
way under Bun), not anything spawnUnit-specific.

## Parameters

### onShutdown

() => `void`

## Returns

`void`
