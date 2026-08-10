[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client](../../README.md) / [daemon-client](../README.md) / SpawnDetachedDaemonOptions

# Interface: SpawnDetachedDaemonOptions

Defined in: [packages/vehicle-client/src/daemon-client.ts:607](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L607)

## Properties

### args?

> `optional` **args?**: `string`[]

Defined in: [packages/vehicle-client/src/daemon-client.ts:610](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L610)

***

### binPath

> **binPath**: `string`

Defined in: [packages/vehicle-client/src/daemon-client.ts:609](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L609)

Path to the daemon's entry point, e.g. a `#!/usr/bin/env bun` cli.ts.

***

### env?

> `optional` **env?**: `Record`\<`string`, `string` \| `undefined`\>

Defined in: [packages/vehicle-client/src/daemon-client.ts:611](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L611)

***

### platform?

> `optional` **platform?**: `Platform`

Defined in: [packages/vehicle-client/src/daemon-client.ts:613](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L613)

Defaults to process.platform. Exposed for tests -- never meant to be overridden in production.

***

### spawn

> **spawn**: (`command`, `args`, `options`) => `void`

Defined in: [packages/vehicle-client/src/daemon-client.ts:621](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L621)

The actual spawn function, injected so this module never hard-imports
node:child_process (this file has no imports of its own -- see the
module doc comment -- keeping it that way matters for Pi's jiti loader).
Each consumer already has a working spawn call; this only supplies the
platform-correct *options* for it.

#### Parameters

##### command

`string`

##### args

`string`[]

##### options

[`SpawnPlatformOptions`](SpawnPlatformOptions.md)

#### Returns

`void`
