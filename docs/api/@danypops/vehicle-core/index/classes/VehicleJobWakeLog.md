[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / VehicleJobWakeLog

# Class: VehicleJobWakeLog

Defined in: [packages/vehicle-core/src/vehicle-jobs.ts:51](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-jobs.ts#L51)

Bounds a job's accumulated progress notifications by count+bytes, same discipline as enforcePayloadSize but across a job's whole lifetime.

## Constructors

### Constructor

> **new VehicleJobWakeLog**(`options`): `VehicleJobWakeLog`

Defined in: [packages/vehicle-core/src/vehicle-jobs.ts:59](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-jobs.ts#L59)

#### Parameters

##### options

[`VehicleJobWakeLogOptions`](../interfaces/VehicleJobWakeLogOptions.md)

#### Returns

`VehicleJobWakeLog`

## Accessors

### cursor

#### Get Signature

> **get** **cursor**(): `number`

Defined in: [packages/vehicle-core/src/vehicle-jobs.ts:90](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-jobs.ts#L90)

Highest seq issued so far (0 if none accepted yet).

##### Returns

`number`

## Methods

### append()

> **append**(`progress`): [`VehicleJobWakeAppendResult`](../interfaces/VehicleJobWakeAppendResult.md)

Defined in: [packages/vehicle-core/src/vehicle-jobs.ts:63](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-jobs.ts#L63)

#### Parameters

##### progress

`unknown`

#### Returns

[`VehicleJobWakeAppendResult`](../interfaces/VehicleJobWakeAppendResult.md)

***

### since()

> **since**(`cursor`): readonly [`VehicleJobWakeEntry`](../interfaces/VehicleJobWakeEntry.md)[]

Defined in: [packages/vehicle-core/src/vehicle-jobs.ts:85](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-jobs.ts#L85)

Entries with seq strictly greater than `cursor`.

#### Parameters

##### cursor

`number`

#### Returns

readonly [`VehicleJobWakeEntry`](../interfaces/VehicleJobWakeEntry.md)[]
