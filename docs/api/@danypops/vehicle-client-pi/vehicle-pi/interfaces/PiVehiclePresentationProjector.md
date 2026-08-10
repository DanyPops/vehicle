[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-pi](../README.md) / PiVehiclePresentationProjector

# Interface: PiVehiclePresentationProjector

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:92](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L92)

## Properties

### maxBytes

> `readonly` **maxBytes**: `number`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:94](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L94)

Required bound over UTF-8 JSON bytes of the projector's return value.

## Methods

### project()

> **project**(`output`, `request`): `JsonValue` \| `Promise`\<`JsonValue`\>

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:96](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L96)

Runs once after the successful invocation and any interactive follow-up, before Pi persists details.

#### Parameters

##### output

`unknown`

##### request

[`PiVehicleInvocationRequest`](PiVehicleInvocationRequest.md)

#### Returns

`JsonValue` \| `Promise`\<`JsonValue`\>

***

### projectProgress()?

> `optional` **projectProgress**(`progress`, `request`): `JsonValue`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:98](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L98)

Optional synchronous projection for transient progress updates. A failure drops that update and never aborts the invocation.

#### Parameters

##### progress

`unknown`

##### request

[`PiVehicleInvocationRequest`](PiVehicleInvocationRequest.md)

#### Returns

`JsonValue`
