[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [service](../README.md) / ServiceSpec

# Interface: ServiceSpec

Defined in: [packages/vehicle-server/src/service.ts:10](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/service.ts#L10)

## Properties

### args?

> `optional` **args?**: `string`[]

Defined in: [packages/vehicle-server/src/service.ts:19](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/service.ts#L19)

***

### binPath

> **binPath**: `string`

Defined in: [packages/vehicle-server/src/service.ts:18](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/service.ts#L18)

Absolute path to the daemon's entry point (e.g. a `#!/usr/bin/env bun` cli.ts).

***

### displayName?

> `optional` **displayName?**: `string`

Defined in: [packages/vehicle-server/src/service.ts:14](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/service.ts#L14)

Human display name, e.g. "Web Spider". Defaults to `name`.

***

### env?

> `optional` **env?**: `Record`\<`string`, `string`\>

Defined in: [packages/vehicle-server/src/service.ts:20](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/service.ts#L20)

***

### handlePath

> **handlePath**: `string`

Defined in: [packages/vehicle-server/src/service.ts:22](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/service.ts#L22)

Absolute Vehicle handle path used for bounded readiness checks.

***

### name

> **name**: `string`

Defined in: [packages/vehicle-server/src/service.ts:12](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/service.ts#L12)

Used in filenames/labels, e.g. "web-spider". Must be filesystem/registry-value-name safe.

***

### noNewPrivileges?

> `optional` **noNewPrivileges?**: `boolean`

Defined in: [packages/vehicle-server/src/service.ts:29](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/service.ts#L29)

Requires the native manager to prevent privilege escalation.

***

### privateTmp?

> `optional` **privateTmp?**: `boolean`

Defined in: [packages/vehicle-server/src/service.ts:31](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/service.ts#L31)

Requires the native manager to isolate the daemon's temporary directory.

***

### restartOnFailure?

> `optional` **restartOnFailure?**: `boolean`

Defined in: [packages/vehicle-server/src/service.ts:25](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/service.ts#L25)

Requests Armada-managed on-failure restart.

***

### restartSec?

> `optional` **restartSec?**: `number`

Defined in: [packages/vehicle-server/src/service.ts:27](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/service.ts#L27)

Restart delay in seconds, applied with restartOnFailure.

***

### version

> **version**: `string`

Defined in: [packages/vehicle-server/src/service.ts:16](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/service.ts#L16)

Installed package or daemon version projected into Armada desired state.

***

### waitForNetwork?

> `optional` **waitForNetwork?**: `boolean`

Defined in: [packages/vehicle-server/src/service.ts:33](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/service.ts#L33)

Requires the native manager to wait for network readiness before starting.

***

### workingDirectory?

> `optional` **workingDirectory?**: `string`

Defined in: [packages/vehicle-server/src/service.ts:23](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/service.ts#L23)
