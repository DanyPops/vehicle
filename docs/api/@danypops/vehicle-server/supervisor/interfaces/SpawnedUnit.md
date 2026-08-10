[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [supervisor](../README.md) / SpawnedUnit

# Interface: SpawnedUnit

Defined in: [packages/vehicle-server/src/supervisor.ts:25](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/supervisor.ts#L25)

## Properties

### exited

> **exited**: `Promise`\<`number`\>

Defined in: [packages/vehicle-server/src/supervisor.ts:28](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/supervisor.ts#L28)

***

### name

> **name**: `string`

Defined in: [packages/vehicle-server/src/supervisor.ts:26](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/supervisor.ts#L26)

***

### pid

> **pid**: `number`

Defined in: [packages/vehicle-server/src/supervisor.ts:27](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/supervisor.ts#L27)

## Methods

### kill()

> **kill**(`signal?`): `void`

Defined in: [packages/vehicle-server/src/supervisor.ts:30](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/supervisor.ts#L30)

Raw signal delivery -- on Windows, Node/Bun's kill("SIGTERM") unconditionally terminates the process without ever invoking a handler. Prefer requestGracefulShutdown() for "let the unit clean up first"; reach for kill() only when an immediate, unconditional stop is actually what's wanted (e.g. SIGKILL).

#### Parameters

##### signal?

`number` \| `Signals`

#### Returns

`void`

***

### requestGracefulShutdown()

> **requestGracefulShutdown**(): `void`

Defined in: [packages/vehicle-server/src/supervisor.ts:41](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/supervisor.ts#L41)

Cross-platform graceful shutdown: a real SIGTERM on POSIX (unchanged
behavior), or -- on Windows, where SIGTERM cannot be delivered to a
child at all -- a magic line written to the unit's stdin instead. A
unit that calls awaitGracefulShutdown() (below) reacts identically to
either path; a unit that hand-rolls its own `process.on("SIGTERM", ...)`
and nothing else will not see the Windows fallback and needs
migrating to that helper (or kill()'d forcefully) to actually stop
gracefully there.

#### Returns

`void`
