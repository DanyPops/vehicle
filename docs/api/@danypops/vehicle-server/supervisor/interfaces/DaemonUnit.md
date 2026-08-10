[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [supervisor](../README.md) / DaemonUnit

# Interface: DaemonUnit

Defined in: [packages/vehicle-server/src/supervisor.ts:9](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/supervisor.ts#L9)

Minimal subprocess-spawn primitive for a daemon that supervises other
daemons (e.g. enigma spawning pipes-daemon/tickets-daemon with credentials
injected as env). Deliberately not a process manager: restart policy,
exit-code handling, and unit lifecycle belong to the caller. This module's
only job is "start one subprocess with these extra env vars," reliably.

## Extended by

- [`SupervisedUnitConfig`](../../process-supervisor/interfaces/SupervisedUnitConfig.md)

## Properties

### args?

> `optional` **args?**: `string`[]

Defined in: [packages/vehicle-server/src/supervisor.ts:13](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/supervisor.ts#L13)

***

### backends

> **backends**: `string`[]

Defined in: [packages/vehicle-server/src/supervisor.ts:17](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/supervisor.ts#L17)

Credential backend names this unit needs — resolved and injected by the caller, not by spawnUnit itself.

***

### bin

> **bin**: `string`

Defined in: [packages/vehicle-server/src/supervisor.ts:12](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/supervisor.ts#L12)

Path to a `#!/usr/bin/env bun` daemon entry point.

***

### env?

> `optional` **env?**: `Record`\<`string`, `string`\>

Defined in: [packages/vehicle-server/src/supervisor.ts:15](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/supervisor.ts#L15)

Non-secret env forwarded to the child as-is.

***

### name

> **name**: `string`

Defined in: [packages/vehicle-server/src/supervisor.ts:10](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/supervisor.ts#L10)

***

### restart?

> `optional` **restart?**: `"always"` \| `"on-failure"` \| `"no"`

Defined in: [packages/vehicle-server/src/supervisor.ts:18](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/supervisor.ts#L18)
