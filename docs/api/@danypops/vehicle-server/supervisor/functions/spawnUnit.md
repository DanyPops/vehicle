[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [supervisor](../README.md) / spawnUnit

# Function: spawnUnit()

> **spawnUnit**(`unit`, `credsEnv?`, `options?`): [`SpawnedUnit`](../interfaces/SpawnedUnit.md)

Defined in: [packages/vehicle-server/src/supervisor.ts:67](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/supervisor.ts#L67)

Spawns one unit with `credsEnv` merged over `unit.env` merged over the
current process env — credentials take precedence over a unit's own
static config in case of an accidental name collision, since a stale
hardcoded value should never silently shadow a freshly fetched one.

stdin is piped (not the prior "ignore") so requestGracefulShutdown() has
somewhere to write its Windows fallback; nothing about a unit's own
stdout/stderr inheritance changes.

## Parameters

### unit

[`DaemonUnit`](../interfaces/DaemonUnit.md)

### credsEnv?

`Record`\<`string`, `string`\> = `{}`

### options?

[`SpawnUnitOptions`](../interfaces/SpawnUnitOptions.md) = `{}`

## Returns

[`SpawnedUnit`](../interfaces/SpawnedUnit.md)
