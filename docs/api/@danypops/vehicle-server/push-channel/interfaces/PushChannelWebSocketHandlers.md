[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [push-channel](../README.md) / PushChannelWebSocketHandlers

# Interface: PushChannelWebSocketHandlers

Defined in: [packages/vehicle-server/src/push-channel.ts:40](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/push-channel.ts#L40)

## Methods

### close()

> **close**(`ws`): `void`

Defined in: [packages/vehicle-server/src/push-channel.ts:43](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/push-channel.ts#L43)

#### Parameters

##### ws

`PushSocket`

#### Returns

`void`

***

### message()

> **message**(`ws`, `message`): `void`

Defined in: [packages/vehicle-server/src/push-channel.ts:42](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/push-channel.ts#L42)

#### Parameters

##### ws

`PushSocket`

##### message

`string` \| `Buffer`\<`ArrayBufferLike`\>

#### Returns

`void`

***

### open()

> **open**(`ws`): `void`

Defined in: [packages/vehicle-server/src/push-channel.ts:41](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/push-channel.ts#L41)

#### Parameters

##### ws

`PushSocket`

#### Returns

`void`
