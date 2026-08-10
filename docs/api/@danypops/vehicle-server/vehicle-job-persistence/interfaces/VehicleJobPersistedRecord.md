[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [vehicle-job-persistence](../README.md) / VehicleJobPersistedRecord

# Interface: VehicleJobPersistedRecord

Defined in: [packages/vehicle-server/src/vehicle-job-persistence.ts:19](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-persistence.ts#L19)

## Properties

### createdAt

> `readonly` **createdAt**: `number`

Defined in: [packages/vehicle-server/src/vehicle-job-persistence.ts:24](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-persistence.ts#L24)

***

### delivered

> `readonly` **delivered**: `boolean`

Defined in: [packages/vehicle-server/src/vehicle-job-persistence.ts:27](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-persistence.ts#L27)

***

### error?

> `readonly` `optional` **error?**: `VehicleFailure`

Defined in: [packages/vehicle-server/src/vehicle-job-persistence.ts:30](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-persistence.ts#L30)

***

### instanceToken

> `readonly` **instanceToken**: `string`

Defined in: [packages/vehicle-server/src/vehicle-job-persistence.ts:26](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-persistence.ts#L26)

***

### jobId

> `readonly` **jobId**: `string`

Defined in: [packages/vehicle-server/src/vehicle-job-persistence.ts:20](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-persistence.ts#L20)

***

### operationName

> `readonly` **operationName**: `string`

Defined in: [packages/vehicle-server/src/vehicle-job-persistence.ts:21](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-persistence.ts#L21)

***

### operationVersion

> `readonly` **operationVersion**: `number`

Defined in: [packages/vehicle-server/src/vehicle-job-persistence.ts:22](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-persistence.ts#L22)

***

### output?

> `readonly` `optional` **output?**: `unknown`

Defined in: [packages/vehicle-server/src/vehicle-job-persistence.ts:29](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-persistence.ts#L29)

***

### status

> `readonly` **status**: `VehicleJobStatus`

Defined in: [packages/vehicle-server/src/vehicle-job-persistence.ts:23](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-persistence.ts#L23)

***

### terminationReason?

> `readonly` `optional` **terminationReason?**: `"timeout"` \| `"succeeded"` \| `"failed"` \| `"canceled"` \| `"orphaned"`

Defined in: [packages/vehicle-server/src/vehicle-job-persistence.ts:28](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-persistence.ts#L28)

***

### updatedAt

> `readonly` **updatedAt**: `number`

Defined in: [packages/vehicle-server/src/vehicle-job-persistence.ts:25](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-persistence.ts#L25)

***

### wakeEntries

> `readonly` **wakeEntries**: readonly `VehicleJobWakeEntry`[]

Defined in: [packages/vehicle-server/src/vehicle-job-persistence.ts:31](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-persistence.ts#L31)
