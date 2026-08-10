[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / AtomicJsonFsAdapter

# Interface: AtomicJsonFsAdapter

Defined in: [packages/vehicle-core/src/atomic-json.ts:21](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/atomic-json.ts#L21)

Cross-platform atomic JSON persistence -- shared by every Vehicle
primitive that needs durable state (Jobs' status file, Watchers'
registry) so a crash or concurrent read never observes a half-written
file. Lives in vehicle-core (not vehicle-server) but stays fs-free
itself: every filesystem operation is injected via `AtomicJsonFsAdapter`,
matching vehicle-core's own "zero runtime dependencies" invariant --
the caller (vehicle-server, vehicle-client-pi) supplies real node:fs
functions, this module only sequences them.

Modeled on github.com/nicobailon/pi-subagents' `createAtomicJsonWriter`:
a collision-safe temp filename, injectable fs/now/pid/random for
deterministic tests, and explicit Windows-aware rename retry (a plain
`fs.rename` onto an existing path can transiently fail on Windows if
another process -- antivirus, search indexing -- has the destination
briefly open; POSIX rename() has no such failure mode, so retrying by
default there would only add latency for a class of error that never
happens).

## Methods

### readFile()

> **readFile**(`path`): `Promise`\<`string`\>

Defined in: [packages/vehicle-core/src/atomic-json.ts:26](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/atomic-json.ts#L26)

#### Parameters

##### path

`string`

#### Returns

`Promise`\<`string`\>

***

### rename()

> **rename**(`oldPath`, `newPath`): `Promise`\<`void`\>

Defined in: [packages/vehicle-core/src/atomic-json.ts:24](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/atomic-json.ts#L24)

#### Parameters

##### oldPath

`string`

##### newPath

`string`

#### Returns

`Promise`\<`void`\>

***

### unlink()

> **unlink**(`path`): `Promise`\<`void`\>

Defined in: [packages/vehicle-core/src/atomic-json.ts:25](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/atomic-json.ts#L25)

#### Parameters

##### path

`string`

#### Returns

`Promise`\<`void`\>

***

### writeFile()

> **writeFile**(`path`, `data`, `mode?`): `Promise`\<`void`\>

Defined in: [packages/vehicle-core/src/atomic-json.ts:23](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/atomic-json.ts#L23)

`mode` is a POSIX file-mode bitmask (e.g. 0o600); omitted means the platform/adapter's own default.

#### Parameters

##### path

`string`

##### data

`string`

##### mode?

`number`

#### Returns

`Promise`\<`void`\>
