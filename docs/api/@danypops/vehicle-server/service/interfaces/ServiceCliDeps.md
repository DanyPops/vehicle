[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [service](../README.md) / ServiceCliDeps

# Interface: ServiceCliDeps

Defined in: [packages/vehicle-server/src/service.ts:298](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/service.ts#L298)

## Extends

- [`ServiceInstallDeps`](ServiceInstallDeps.md)

## Properties

### armadaCliPath

> **armadaCliPath**: `string`

Defined in: [packages/vehicle-server/src/service.ts:45](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/service.ts#L45)

Resolved published Armada CLI entrypoint.

#### Inherited from

[`ServiceInstallDeps`](ServiceInstallDeps.md).[`armadaCliPath`](ServiceInstallDeps.md#armadaclipath)

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

#### Inherited from

[`ServiceInstallDeps`](ServiceInstallDeps.md).[`runCommand`](ServiceInstallDeps.md#runcommand)

***

### runSystemctl?

> `optional` **runSystemctl?**: (`action`, `unitName`) => `void`

Defined in: [packages/vehicle-server/src/service.ts:300](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/service.ts#L300)

Defaults to a real `systemctl --user <action> <unitName>` shell-out.

#### Parameters

##### action

[`ServiceAction`](../type-aliases/ServiceAction.md)

##### unitName

`string`

#### Returns

`void`
