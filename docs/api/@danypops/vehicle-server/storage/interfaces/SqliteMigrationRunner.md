[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [storage](../README.md) / SqliteMigrationRunner

# Interface: SqliteMigrationRunner\<Handle\>

Defined in: [packages/vehicle-server/src/storage.ts:48](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/storage.ts#L48)

Runtime-agnostic port runMigrations needs: read/write the schema version marker and wrap
one migration in a transaction. Implement this over any SQLite-shaped store to reuse the
generic engine below without modifying it -- see sqliteMigrationRunner for the reference
adapter that openSqliteWithPragmas itself uses (works against both the bun:sqlite and
node:sqlite handles openRawDatabase can return, since it only touches exec/query/transaction).

## Type Parameters

### Handle

`Handle`

## Properties

### raw

> **raw**: `Handle`

Defined in: [packages/vehicle-server/src/storage.ts:50](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/storage.ts#L50)

The raw handle passed to each Migration's up().

## Methods

### setUserVersion()

> **setUserVersion**(`version`): `void`

Defined in: [packages/vehicle-server/src/storage.ts:52](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/storage.ts#L52)

#### Parameters

##### version

`number`

#### Returns

`void`

***

### transaction()

> **transaction**(`fn`): `void`

Defined in: [packages/vehicle-server/src/storage.ts:53](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/storage.ts#L53)

#### Parameters

##### fn

() => `void`

#### Returns

`void`

***

### userVersion()

> **userVersion**(): `number`

Defined in: [packages/vehicle-server/src/storage.ts:51](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/storage.ts#L51)

#### Returns

`number`
