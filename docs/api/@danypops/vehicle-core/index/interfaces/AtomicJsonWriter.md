[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / AtomicJsonWriter

# Interface: AtomicJsonWriter

Defined in: [packages/vehicle-core/src/atomic-json.ts:60](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/atomic-json.ts#L60)

## Methods

### read()

> **read**(`filePath`): `Promise`\<`unknown`\>

Defined in: [packages/vehicle-core/src/atomic-json.ts:64](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/atomic-json.ts#L64)

Reads and JSON.parses `filePath`. Returns undefined if the file doesn't exist (fs.readFile throws ENOENT); rethrows any other error.

#### Parameters

##### filePath

`string`

#### Returns

`Promise`\<`unknown`\>

***

### write()

> **write**(`filePath`, `value`, `options?`): `Promise`\<`void`\>

Defined in: [packages/vehicle-core/src/atomic-json.ts:62](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/atomic-json.ts#L62)

Serializes `value` to JSON and writes it to `filePath` atomically (temp file + rename).

#### Parameters

##### filePath

`string`

##### value

`unknown`

##### options?

[`AtomicJsonWriteOptions`](AtomicJsonWriteOptions.md)

#### Returns

`Promise`\<`void`\>
