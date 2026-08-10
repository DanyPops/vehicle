[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [storage](../README.md) / openSqliteWithPragmas

# Function: openSqliteWithPragmas()

> **openSqliteWithPragmas**(`path`, `options`): `Database`

Defined in: [packages/vehicle-server/src/storage.ts:145](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/storage.ts#L145)

Opens (creating parent directories as needed) and migrates a SQLite
database -- see openRawDatabase for which runtime backs it. Safe to call on
every daemon start: migrations already applied (per PRAGMA user_version)
are skipped. Built on the generic runMigrations engine via
sqliteMigrationRunner -- see that engine's doc comment for how a different
SQLite binding reuses it without editing this function.

## Parameters

### path

`string`

### options

[`OpenSqliteOptions`](../interfaces/OpenSqliteOptions.md)

## Returns

`Database`
