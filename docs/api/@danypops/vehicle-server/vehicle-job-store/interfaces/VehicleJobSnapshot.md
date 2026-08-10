[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [vehicle-job-store](../README.md) / VehicleJobSnapshot

# Interface: VehicleJobSnapshot

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:41](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L41)

## Properties

### createdAt

> `readonly` **createdAt**: `number`

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:46](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L46)

***

### delivered

> `readonly` **delivered**: `boolean`

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:48](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L48)

***

### error?

> `readonly` `optional` **error?**: `VehicleFailure`

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:51](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L51)

***

### jobId

> `readonly` **jobId**: `string`

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:42](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L42)

***

### operationName

> `readonly` **operationName**: `string`

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:43](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L43)

***

### operationVersion

> `readonly` **operationVersion**: `number`

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:44](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L44)

***

### output?

> `readonly` `optional` **output?**: `unknown`

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:50](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L50)

***

### status

> `readonly` **status**: `VehicleJobStatus`

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:45](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L45)

***

### terminationReason?

> `readonly` `optional` **terminationReason?**: `"timeout"` \| `"succeeded"` \| `"failed"` \| `"canceled"` \| `"orphaned"`

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:49](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L49)

***

### updatedAt

> `readonly` **updatedAt**: `number`

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:47](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L47)
