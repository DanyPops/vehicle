[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / AtomicJsonWriteOptions

# Interface: AtomicJsonWriteOptions

Defined in: [packages/vehicle-core/src/atomic-json.ts:29](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/atomic-json.ts#L29)

## Properties

### mode?

> `readonly` `optional` **mode?**: `number`

Defined in: [packages/vehicle-core/src/atomic-json.ts:31](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/atomic-json.ts#L31)

POSIX file-mode bitmask for the written file (e.g. 0o600 for a secret/credential-adjacent file). Omitted means the adapter's own default.

***

### pretty?

> `readonly` `optional` **pretty?**: `boolean`

Defined in: [packages/vehicle-core/src/atomic-json.ts:33](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/atomic-json.ts#L33)

Pretty-prints with 2-space indentation (matching JSON.stringify(value, null, 2)) for a human-editable file. Defaults to false (compact).

***

### trailingNewline?

> `readonly` `optional` **trailingNewline?**: `boolean`

Defined in: [packages/vehicle-core/src/atomic-json.ts:35](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/atomic-json.ts#L35)

Appends a trailing "\n" -- the common POSIX text-file convention. Defaults to false (exact JSON.stringify output, unchanged).
