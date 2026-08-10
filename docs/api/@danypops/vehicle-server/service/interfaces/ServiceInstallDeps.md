[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [service](../README.md) / ServiceInstallDeps

# Interface: ServiceInstallDeps

Defined in: [packages/vehicle-server/src/service.ts:41](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/service.ts#L41)

## Extended by

- [`ServiceCliDeps`](ServiceCliDeps.md)

## Properties

### armadaCliPath

> **armadaCliPath**: `string`

Defined in: [packages/vehicle-server/src/service.ts:45](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/service.ts#L45)

Resolved published Armada CLI entrypoint.

***

### runCommand

> **runCommand**: (`command`, `args`, `input?`) => [`RunResult`](RunResult.md)

Defined in: [packages/vehicle-server/src/service.ts:43](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/service.ts#L43)

Runs a command to completion. Never throws -- failures are reported via `ok: false`.

#### Parameters

##### command

`string`

##### args

`string`[]

##### input?

`string`

#### Returns

[`RunResult`](RunResult.md)
