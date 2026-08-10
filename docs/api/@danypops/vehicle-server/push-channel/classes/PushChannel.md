[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [push-channel](../README.md) / PushChannel

# Class: PushChannel

Defined in: [packages/vehicle-server/src/push-channel.ts:49](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/push-channel.ts#L49)

## Constructors

### Constructor

> **new PushChannel**(`options`): `PushChannel`

Defined in: [packages/vehicle-server/src/push-channel.ts:56](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/push-channel.ts#L56)

#### Parameters

##### options

[`PushChannelOptions`](../interfaces/PushChannelOptions.md)

#### Returns

`PushChannel`

## Accessors

### connectionCount

#### Get Signature

> **get** **connectionCount**(): `number`

Defined in: [packages/vehicle-server/src/push-channel.ts:62](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/push-channel.ts#L62)

##### Returns

`number`

## Methods

### publish()

> **publish**(`topic`, `payload`): `void`

Defined in: [packages/vehicle-server/src/push-channel.ts:114](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/push-channel.ts#L114)

Broadcasts `payload` to every connection currently subscribed to `topic`. A no-op if nobody is subscribed.

#### Parameters

##### topic

`string`

##### payload

`unknown`

#### Returns

`void`

***

### upgrade()

> **upgrade**(`request`, `server`): `Response` \| `null`

Defined in: [packages/vehicle-server/src/push-channel.ts:72](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/push-channel.ts#L72)

Call from a daemon's fetch handler when the request path matches your
push endpoint (e.g. "/push"). Returns null when the upgrade succeeded
(Bun's own convention: don't return a Response after a successful
server.upgrade()) -- return the Response otherwise.

#### Parameters

##### request

`Request`

##### server

`ServerLike`

#### Returns

`Response` \| `null`

***

### websocketHandlers()

> **websocketHandlers**(): [`PushChannelWebSocketHandlers`](../interfaces/PushChannelWebSocketHandlers.md)

Defined in: [packages/vehicle-server/src/push-channel.ts:81](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/push-channel.ts#L81)

Bun.serve's `websocket` handler object -- pass directly as `Bun.serve({ ..., websocket: pushChannel.websocketHandlers() })`.

#### Returns

[`PushChannelWebSocketHandlers`](../interfaces/PushChannelWebSocketHandlers.md)
