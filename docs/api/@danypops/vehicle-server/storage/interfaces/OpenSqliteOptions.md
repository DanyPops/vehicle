[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [storage](../README.md) / OpenSqliteOptions

# Interface: OpenSqliteOptions

Defined in: [packages/vehicle-server/src/storage.ts:56](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/storage.ts#L56)

## Properties

### busyTimeoutMs?

> `optional` **busyTimeoutMs?**: `number`

Defined in: [packages/vehicle-server/src/storage.ts:58](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/storage.ts#L58)

***

### databaseOptions?

> `optional` **databaseOptions?**: `DatabaseOptions`

Defined in: [packages/vehicle-server/src/storage.ts:60](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/storage.ts#L60)

Passed through to `new Database(path, databaseOptions)` verbatim -- e.g. { create: true, strict: true }.

***

### migrations

> **migrations**: [`Migration`](Migration.md)\<`Database`\>[]

Defined in: [packages/vehicle-server/src/storage.ts:57](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/storage.ts#L57)
