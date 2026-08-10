[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [process-supervisor](../README.md) / RunningProcessSupervisor

# Interface: RunningProcessSupervisor

Defined in: [packages/vehicle-server/src/process-supervisor.ts:31](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/process-supervisor.ts#L31)

## Methods

### restartUnit()

> **restartUnit**(`name`): `void`

Defined in: [packages/vehicle-server/src/process-supervisor.ts:35](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/process-supervisor.ts#L35)

Kills and relaunches a unit bypassing restart policy entirely -- an explicit external trigger, independent of the periodic shouldPlannedRestart check. A no-op for an unknown or already-stopped unit name.

#### Parameters

##### name

`string`

#### Returns

`void`

***

### stop()

> **stop**(): `Promise`\<`void`\>

Defined in: [packages/vehicle-server/src/process-supervisor.ts:33](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/process-supervisor.ts#L33)

Documented shutdown contract: every unit gets SIGTERM and stop() resolves only once all of them have actually exited.

#### Returns

`Promise`\<`void`\>
