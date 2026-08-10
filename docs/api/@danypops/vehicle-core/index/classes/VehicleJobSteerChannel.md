[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / VehicleJobSteerChannel

# Class: VehicleJobSteerChannel

Defined in: [packages/vehicle-core/src/vehicle-jobs.ts:145](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-jobs.ts#L145)

## Implements

- `AsyncIterable`\<`unknown`\>

## Constructors

### Constructor

> **new VehicleJobSteerChannel**(`maxQueueSize?`): `VehicleJobSteerChannel`

Defined in: [packages/vehicle-core/src/vehicle-jobs.ts:150](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-jobs.ts#L150)

#### Parameters

##### maxQueueSize?

`number` = `64`

#### Returns

`VehicleJobSteerChannel`

## Methods

### \[asyncIterator\]()

> **\[asyncIterator\]**(): `AsyncIterator`\<`unknown`\>

Defined in: [packages/vehicle-core/src/vehicle-jobs.ts:171](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-jobs.ts#L171)

#### Returns

`AsyncIterator`\<`unknown`\>

#### Implementation of

`AsyncIterable.[asyncIterator]`

***

### close()

> **close**(): `void`

Defined in: [packages/vehicle-core/src/vehicle-jobs.ts:165](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-jobs.ts#L165)

Ends every pending and future iteration with done:true; further push() calls report "channel-closed". Idempotent.

#### Returns

`void`

***

### push()

> **push**(`value`): [`VehicleJobSteerPushResult`](../interfaces/VehicleJobSteerPushResult.md)

Defined in: [packages/vehicle-core/src/vehicle-jobs.ts:152](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-jobs.ts#L152)

#### Parameters

##### value

`unknown`

#### Returns

[`VehicleJobSteerPushResult`](../interfaces/VehicleJobSteerPushResult.md)
