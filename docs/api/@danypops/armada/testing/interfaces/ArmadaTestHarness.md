[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/armada](../../README.md) / [testing](../README.md) / ArmadaTestHarness

# Interface: ArmadaTestHarness

Defined in: [testing.ts:93](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/testing.ts#L93)

## Properties

### controller

> `readonly` **controller**: [`NativeServiceController`](../../index/interfaces/NativeServiceController.md)

Defined in: [testing.ts:97](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/testing.ts#L97)

***

### manifestPath

> `readonly` **manifestPath**: `string`

Defined in: [testing.ts:95](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/testing.ts#L95)

***

### readiness

> `readonly` **readiness**: [`ReadinessProbe`](../../index/interfaces/ReadinessProbe.md)

Defined in: [testing.ts:98](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/testing.ts#L98)

***

### registrar

> `readonly` **registrar**: [`VehicleRegistrar`](../../index/interfaces/VehicleRegistrar.md)

Defined in: [testing.ts:96](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/testing.ts#L96)

***

### root

> `readonly` **root**: `string`

Defined in: [testing.ts:94](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/testing.ts#L94)

## Methods

### application()

> **application**(`name`): [`MockVehicleApplication`](MockVehicleApplication.md)

Defined in: [testing.ts:99](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/testing.ts#L99)

#### Parameters

##### name

`string`

#### Returns

[`MockVehicleApplication`](MockVehicleApplication.md)

***

### dispose()

> **dispose**(): `Promise`\<`void`\>

Defined in: [testing.ts:103](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/testing.ts#L103)

#### Returns

`Promise`\<`void`\>

***

### events()

> **events**(): readonly `string`[]

Defined in: [testing.ts:100](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/testing.ts#L100)

#### Returns

readonly `string`[]

***

### status()

> **status**(): `Promise`\<[`FleetStatusReport`](../../index/interfaces/FleetStatusReport.md)\>

Defined in: [testing.ts:101](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/testing.ts#L101)

#### Returns

`Promise`\<[`FleetStatusReport`](../../index/interfaces/FleetStatusReport.md)\>

***

### waitForEvent()

> **waitForEvent**(`event`): `Promise`\<`void`\>

Defined in: [testing.ts:102](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/testing.ts#L102)

#### Parameters

##### event

`string`

#### Returns

`Promise`\<`void`\>
