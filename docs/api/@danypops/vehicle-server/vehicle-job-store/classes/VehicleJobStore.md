[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [vehicle-job-store](../README.md) / VehicleJobStore

# Class: VehicleJobStore

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:119](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L119)

## Constructors

### Constructor

> **new VehicleJobStore**(`registry`, `options?`): `VehicleJobStore`

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:131](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L131)

#### Parameters

##### registry

[`VehicleRegistry`](../../vehicle-registry/classes/VehicleRegistry.md)

##### options?

[`VehicleJobStoreOptions`](../interfaces/VehicleJobStoreOptions.md) = `{}`

#### Returns

`VehicleJobStore`

## Properties

### instanceToken

> `readonly` **instanceToken**: `string`

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:128](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L128)

Fresh per construction -- see vehicleJobIdentityMatches. Stamped onto every job this instance submits; a persisted record's own token only ever matches the instance that wrote it.

## Methods

### cancel()

> **cancel**(`jobId`): `void`

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:293](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L293)

No-op against an already-terminal job.

#### Parameters

##### jobId

`string`

#### Returns

`void`

***

### flushPersistence()

> **flushPersistence**(): `Promise`\<`void`\>

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:331](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L331)

Resolves once every persistence write scheduled so far has settled. No-op if no persistence adapter is configured. Intended for tests and a clean daemon shutdown, not the request path.

#### Returns

`Promise`\<`void`\>

***

### markDelivered()

> **markDelivered**(`jobId`): `void`

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:320](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L320)

Marks a terminal job's result as delivered to its caller -- only a
delivered job is ever eligible for the retention sweep's eviction.
Idempotent. Safe to call on a still-running job (a no-op until it
settles), though the intended caller is "I successfully read this
job's final poll() result."

#### Parameters

##### jobId

`string`

#### Returns

`void`

***

### poll()

> **poll**(`jobId`): [`VehicleJobSnapshot`](../interfaces/VehicleJobSnapshot.md)

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:270](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L270)

Never blocks -- current status, plus output/error once terminal.

#### Parameters

##### jobId

`string`

#### Returns

[`VehicleJobSnapshot`](../interfaces/VehicleJobSnapshot.md)

***

### restore()

> **restore**(): `Promise`\<[`VehicleJobRestoreResult`](../interfaces/VehicleJobRestoreResult.md)\>

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:152](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L152)

Loads whatever this store's persistence adapter has on disk, reconciling
any job left "running" into an orphaned failure (see
vehicleJobIdentityMatches -- a fresh instanceToken never matches a
persisted one, so every restored "running" record is, by construction,
from a process that's gone). Call once at daemon startup, before serving
any request. A no-op if no persistence adapter was configured, or
nothing was ever saved.

#### Returns

`Promise`\<[`VehicleJobRestoreResult`](../interfaces/VehicleJobRestoreResult.md)\>

***

### steer()

> **steer**(`jobId`, `input`): `void`

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:300](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L300)

Pushes new input to an already-running job's handler, if it opted in via context.steerInputs. Distinct from cancel(): the job keeps running.

#### Parameters

##### jobId

`string`

##### input

`unknown`

#### Returns

`void`

***

### submit()

> **submit**(`name`, `version`, `input`, `options?`): `object`

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:193](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L193)

Validates and starts a background-capable operation; returns its job id immediately without waiting for the handler to make any progress.

#### Parameters

##### name

`string`

##### version

`number`

##### input

`unknown`

##### options?

[`VehicleJobSubmitOptions`](../interfaces/VehicleJobSubmitOptions.md) = `{}`

#### Returns

`object`

##### jobId

> **jobId**: `string`

***

### tail()

> **tail**(`jobId`, `sinceCursor?`): [`VehicleJobTailResult`](../interfaces/VehicleJobTailResult.md)

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:287](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L287)

Entries after `sinceCursor` (0 for everything so far), plus a cursor for the next call. Never blocks. Works the same for a live job and one restored after a restart.

#### Parameters

##### jobId

`string`

##### sinceCursor?

`number` = `0`

#### Returns

[`VehicleJobTailResult`](../interfaces/VehicleJobTailResult.md)
