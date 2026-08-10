[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [process-supervisor](../README.md) / SupervisedUnitConfig

# Interface: SupervisedUnitConfig

Defined in: [packages/vehicle-server/src/process-supervisor.ts:18](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/process-supervisor.ts#L18)

Minimal subprocess-spawn primitive for a daemon that supervises other
daemons (e.g. enigma spawning pipes-daemon/tickets-daemon with credentials
injected as env). Deliberately not a process manager: restart policy,
exit-code handling, and unit lifecycle belong to the caller. This module's
only job is "start one subprocess with these extra env vars," reliably.

## Extends

- [`DaemonUnit`](../../supervisor/interfaces/DaemonUnit.md)

## Properties

### args?

> `optional` **args?**: `string`[]

Defined in: [packages/vehicle-server/src/supervisor.ts:13](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/supervisor.ts#L13)

#### Inherited from

[`DaemonUnit`](../../supervisor/interfaces/DaemonUnit.md).[`args`](../../supervisor/interfaces/DaemonUnit.md#args)

***

### backends

> **backends**: `string`[]

Defined in: [packages/vehicle-server/src/supervisor.ts:17](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/supervisor.ts#L17)

Credential backend names this unit needs — resolved and injected by the caller, not by spawnUnit itself.

#### Inherited from

[`DaemonUnit`](../../supervisor/interfaces/DaemonUnit.md).[`backends`](../../supervisor/interfaces/DaemonUnit.md#backends)

***

### bin

> **bin**: `string`

Defined in: [packages/vehicle-server/src/supervisor.ts:12](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/supervisor.ts#L12)

Path to a `#!/usr/bin/env bun` daemon entry point.

#### Inherited from

[`DaemonUnit`](../../supervisor/interfaces/DaemonUnit.md).[`bin`](../../supervisor/interfaces/DaemonUnit.md#bin)

***

### env?

> `optional` **env?**: `Record`\<`string`, `string`\>

Defined in: [packages/vehicle-server/src/supervisor.ts:15](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/supervisor.ts#L15)

Non-secret env forwarded to the child as-is.

#### Inherited from

[`DaemonUnit`](../../supervisor/interfaces/DaemonUnit.md).[`env`](../../supervisor/interfaces/DaemonUnit.md#env)

***

### name

> **name**: `string`

Defined in: [packages/vehicle-server/src/supervisor.ts:10](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/supervisor.ts#L10)

#### Inherited from

[`DaemonUnit`](../../supervisor/interfaces/DaemonUnit.md).[`name`](../../supervisor/interfaces/DaemonUnit.md#name)

***

### resolveEnv?

> `optional` **resolveEnv?**: () => `Record`\<`string`, `string`\>

Defined in: [packages/vehicle-server/src/process-supervisor.ts:20](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/process-supervisor.ts#L20)

Called fresh at every (re)launch, not once at supervisor start -- a caller resolving secrets per spawn rather than reusing a stale snapshot.

#### Returns

`Record`\<`string`, `string`\>

***

### restart?

> `optional` **restart?**: `"always"` \| `"on-failure"` \| `"no"`

Defined in: [packages/vehicle-server/src/supervisor.ts:18](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/supervisor.ts#L18)

#### Inherited from

[`DaemonUnit`](../../supervisor/interfaces/DaemonUnit.md).[`restart`](../../supervisor/interfaces/DaemonUnit.md#restart)

***

### shouldPlannedRestart?

> `optional` **shouldPlannedRestart?**: () => `boolean`

Defined in: [packages/vehicle-server/src/process-supervisor.ts:22](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/process-supervisor.ts#L22)

Checked on a timer (plannedRestartCheckMs); true triggers a kill-and-relaunch that bypasses restart policy entirely, for a reason other than a crash.

#### Returns

`boolean`
