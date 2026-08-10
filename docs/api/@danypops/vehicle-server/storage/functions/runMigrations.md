[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [storage](../README.md) / runMigrations

# Function: runMigrations()

> **runMigrations**\<`Handle`\>(`runner`, `migrations`): `void`

Defined in: [packages/vehicle-server/src/storage.ts:73](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/storage.ts#L73)

Applies every not-yet-applied migration (ascending by version) through the given runner,
each inside its own transaction, then advances the version marker -- safe to call on every
daemon start, since already-applied migrations (per the runner's userVersion()) are
skipped. Rejects a version gap (an intermediate migration is missing) or a database newer
than every migration the caller knows about (a downgrade -- older code opening a database
a newer version created) rather than silently no-op-ing or opening an unrecognized schema.

## Type Parameters

### Handle

`Handle`

## Parameters

### runner

[`SqliteMigrationRunner`](../interfaces/SqliteMigrationRunner.md)\<`Handle`\>

### migrations

[`Migration`](../interfaces/Migration.md)\<`Handle`\>[]

## Returns

`void`
