[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [vehicle-job-store](../README.md) / VehicleJobSubmitOptions

# Interface: VehicleJobSubmitOptions

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:26](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L26)

## Properties

### approvalCapability?

> `readonly` `optional` **approvalCapability?**: `string`

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:31](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L31)

***

### correlationId?

> `readonly` `optional` **correlationId?**: `string`

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:32](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L32)

***

### expectedRevision?

> `readonly` `optional` **expectedRevision?**: `string` \| `number`

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:30](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L30)

***

### idempotencyKey?

> `readonly` `optional` **idempotencyKey?**: `string`

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:29](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L29)

***

### maxLifetimeMs?

> `readonly` `optional` **maxLifetimeMs?**: `number`

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:38](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L38)

No default -- unset means the job runs until it settles or is canceled.

***

### notifyMode?

> `readonly` `optional` **notifyMode?**: `VehicleJobNotifyMode`

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:34](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L34)

Defaults to "transition".

***

### permissions?

> `readonly` `optional` **permissions?**: readonly `string`[]

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:27](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L27)

***

### principal?

> `readonly` `optional` **principal?**: `VehiclePrincipal`

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:28](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L28)

***

### wakeBudget?

> `readonly` `optional` **wakeBudget?**: `VehicleJobWakeBudget`

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:36](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L36)

Defaults to background.defaultWakeBudget; clamped to background.maxWakeBudget either way.
