[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [storage](../README.md) / Migration

# Interface: Migration\<Handle\>

Defined in: [packages/vehicle-server/src/storage.ts:35](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/storage.ts#L35)

A single versioned schema migration. Generic over the raw handle its up() mutates directly -- bun:sqlite's Database by default, or another SQLite binding via a SqliteMigrationRunner<Handle> adapter.

## Type Parameters

### Handle

`Handle` = `Database`

## Properties

### up

> **up**: (`handle`) => `void`

Defined in: [packages/vehicle-server/src/storage.ts:38](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/storage.ts#L38)

#### Parameters

##### handle

`Handle`

#### Returns

`void`

***

### version

> **version**: `number`

Defined in: [packages/vehicle-server/src/storage.ts:37](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/storage.ts#L37)

Target PRAGMA user_version this migration produces. Must be applied in ascending order starting from the current version + 1.
