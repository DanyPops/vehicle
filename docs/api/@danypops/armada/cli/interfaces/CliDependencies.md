[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/armada](../../README.md) / [cli](../README.md) / CliDependencies

# Interface: CliDependencies

Defined in: [cli.ts:24](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/cli.ts#L24)

## Properties

### controller?

> `readonly` `optional` **controller?**: [`NativeServiceController`](../../index/interfaces/NativeServiceController.md)

Defined in: [cli.ts:26](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/cli.ts#L26)

***

### env?

> `readonly` `optional` **env?**: `ProcessEnv`

Defined in: [cli.ts:34](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/cli.ts#L34)

***

### executableExists?

> `readonly` `optional` **executableExists?**: (`path`) => `boolean`

Defined in: [cli.ts:30](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/cli.ts#L30)

#### Parameters

##### path

`string`

#### Returns

`boolean`

***

### home?

> `readonly` `optional` **home?**: `string`

Defined in: [cli.ts:35](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/cli.ts#L35)

***

### inspectProcesses?

> `readonly` `optional` **inspectProcesses?**: () => `Promise`\<readonly [`ObservedProcess`](../../index/interfaces/ObservedProcess.md)[]\>

Defined in: [cli.ts:28](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/cli.ts#L28)

#### Returns

`Promise`\<readonly [`ObservedProcess`](../../index/interfaces/ObservedProcess.md)[]\>

***

### io

> `readonly` **io**: [`CliIo`](CliIo.md)

Defined in: [cli.ts:32](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/cli.ts#L32)

***

### manager

> `readonly` **manager**: [`NativeServiceManager`](../../index/interfaces/NativeServiceManager.md)

Defined in: [cli.ts:25](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/cli.ts#L25)

***

### platform?

> `readonly` `optional` **platform?**: `Platform`

Defined in: [cli.ts:33](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/cli.ts#L33)

***

### readHandle?

> `readonly` `optional` **readHandle?**: (`path`) => `Promise`\<`unknown`\>

Defined in: [cli.ts:29](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/cli.ts#L29)

#### Parameters

##### path

`string`

#### Returns

`Promise`\<`unknown`\>

***

### readiness?

> `readonly` `optional` **readiness?**: [`ReadinessProbe`](../../index/interfaces/ReadinessProbe.md)

Defined in: [cli.ts:27](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/cli.ts#L27)

***

### readInput?

> `readonly` `optional` **readInput?**: () => `Promise`\<`string`\>

Defined in: [cli.ts:31](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/cli.ts#L31)

#### Returns

`Promise`\<`string`\>
