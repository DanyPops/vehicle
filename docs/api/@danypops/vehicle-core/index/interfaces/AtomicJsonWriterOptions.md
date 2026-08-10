[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / AtomicJsonWriterOptions

# Interface: AtomicJsonWriterOptions

Defined in: [packages/vehicle-core/src/atomic-json.ts:38](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/atomic-json.ts#L38)

## Properties

### fs

> `readonly` **fs**: [`AtomicJsonFsAdapter`](AtomicJsonFsAdapter.md)

Defined in: [packages/vehicle-core/src/atomic-json.ts:39](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/atomic-json.ts#L39)

***

### now?

> `readonly` `optional` **now?**: () => `number`

Defined in: [packages/vehicle-core/src/atomic-json.ts:41](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/atomic-json.ts#L41)

Defaults to Date.now.

#### Returns

`number`

***

### pid?

> `readonly` `optional` **pid?**: () => `number`

Defined in: [packages/vehicle-core/src/atomic-json.ts:43](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/atomic-json.ts#L43)

Defaults to the current process's pid, or 0 outside Node/Bun.

#### Returns

`number`

***

### random?

> `readonly` `optional` **random?**: () => `string`

Defined in: [packages/vehicle-core/src/atomic-json.ts:45](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/atomic-json.ts#L45)

Defaults to a short random hex string.

#### Returns

`string`

***

### retryDelaysMs?

> `readonly` `optional` **retryDelaysMs?**: readonly `number`[]

Defined in: [packages/vehicle-core/src/atomic-json.ts:55](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/atomic-json.ts#L55)

Delay before each retry attempt, in order. Defaults to [50, 100, 200].

***

### retryRename?

> `readonly` `optional` **retryRename?**: `boolean`

Defined in: [packages/vehicle-core/src/atomic-json.ts:51](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/atomic-json.ts#L51)

Whether a failed rename onto the destination is retried at all.
Defaults to `process.platform === "win32"` -- off on Linux/macOS,
where a transient rename failure isn't a real failure mode.

***

### retryRenameErrors?

> `readonly` `optional` **retryRenameErrors?**: readonly `string`[]

Defined in: [packages/vehicle-core/src/atomic-json.ts:53](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/atomic-json.ts#L53)

Error codes on `rename` worth retrying. Defaults to ["EPERM", "EBUSY", "EACCES"] (the documented Windows file-lock codes).

***

### sleep?

> `readonly` `optional` **sleep?**: (`ms`) => `Promise`\<`void`\>

Defined in: [packages/vehicle-core/src/atomic-json.ts:57](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/atomic-json.ts#L57)

Injectable so a test doesn't have to sleep for real. Defaults to setTimeout.

#### Parameters

##### ms

`number`

#### Returns

`Promise`\<`void`\>
