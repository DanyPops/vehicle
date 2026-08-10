[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client](../../README.md) / [daemon-client](../README.md) / PushChannelClientOptions

# Interface: PushChannelClientOptions

Defined in: [packages/vehicle-client/src/daemon-client.ts:751](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L751)

## Properties

### heartbeatIntervalMs?

> `optional` **heartbeatIntervalMs?**: `number`

Defined in: [packages/vehicle-client/src/daemon-client.ts:777](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L777)

Defaults to 20000ms.

***

### heartbeatTimeoutMs?

> `optional` **heartbeatTimeoutMs?**: `number`

Defined in: [packages/vehicle-client/src/daemon-client.ts:779](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L779)

No message (including a pong) received within this long after the last one means the connection is treated as dead even though it never fired a close event -- a TCP socket can stay open while the peer process is hung. Defaults to 45000ms.

***

### maxReconnectDelayMs?

> `optional` **maxReconnectDelayMs?**: `number`

Defined in: [packages/vehicle-client/src/daemon-client.ts:771](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L771)

Defaults to 30000ms.

***

### minReconnectDelayMs?

> `optional` **minReconnectDelayMs?**: `number`

Defined in: [packages/vehicle-client/src/daemon-client.ts:769](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L769)

Defaults to 1000ms.

***

### minUptimeMs?

> `optional` **minUptimeMs?**: `number`

Defined in: [packages/vehicle-client/src/daemon-client.ts:775](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L775)

A connection must stay open this long before it counts as genuinely stable -- a drop before this elapses keeps the backoff climbing instead of resetting on every brief open. Defaults to 5000ms, mirroring the reference this is modeled on (partysocket's own minUptime).

***

### onMessage

> **onMessage**: (`topic`, `payload`) => `void`

Defined in: [packages/vehicle-client/src/daemon-client.ts:765](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L765)

#### Parameters

##### topic

`string`

##### payload

`unknown`

#### Returns

`void`

***

### onStateChange?

> `optional` **onStateChange?**: (`state`) => `void`

Defined in: [packages/vehicle-client/src/daemon-client.ts:767](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L767)

Fires on every state transition; useful for a status surface (see daemonStatus) or logging.

#### Parameters

##### state

[`PushChannelState`](../type-aliases/PushChannelState.md)

#### Returns

`void`

***

### reconnectionDelayGrowFactor?

> `optional` **reconnectionDelayGrowFactor?**: `number`

Defined in: [packages/vehicle-client/src/daemon-client.ts:773](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L773)

Defaults to 1.5.

***

### token

> **token**: `string`

Defined in: [packages/vehicle-client/src/daemon-client.ts:762](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L762)

***

### topics

> **topics**: readonly `string`[]

Defined in: [packages/vehicle-client/src/daemon-client.ts:764](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L764)

Re-sent as `{op:"subscribe",topic}` after every successful (re)connect -- a reconnect must not silently lose a subscription.

***

### url

> **url**: `string` \| (() => `string` \| `Promise`\<`string`\>)

Defined in: [packages/vehicle-client/src/daemon-client.ts:761](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L761)

e.g. "ws://127.0.0.1:PORT/push" -- `token` is appended as a query
parameter automatically (the WHATWG WebSocket constructor cannot set an
Authorization header). A function is re-invoked on every reconnect
attempt, not just the first -- required for a daemon that rebinds a new
random port on every restart (the same problem connectWithPolicy solves
for one-shot RPC by re-reading the handle file each time); a plain
string only works if the daemon's port never changes across restarts.

***

### WebSocketImpl?

> `optional` **WebSocketImpl?**: \{(`url`, `options?`): `WebSocket`; (`url`, `protocols?`): `WebSocket`; `CLOSED`: `3`; `CLOSING`: `2`; `CONNECTING`: `0`; `OPEN`: `1`; `prototype`: `WebSocket`; \}

Defined in: [packages/vehicle-client/src/daemon-client.ts:781](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L781)

Defaults to the global WebSocket. Injectable for tests.

#### Call Signature

> **new WebSocketImpl**(`url`, `options?`): `WebSocket`

Creates a new WebSocket instance with the given URL and options.

##### Parameters

###### url

`string` \| `URL`

The URL to connect to.

###### options?

`WebSocketOptions`

The options to use for the connection.

##### Returns

`WebSocket`

##### Example

```ts
const ws = new WebSocket("wss://dev.local", {
 protocols: ["proto1", "proto2"],
 headers: {
   "Cookie": "session=123456",
 },
});
```

#### Call Signature

> **new WebSocketImpl**(`url`, `protocols?`): `WebSocket`

Creates a new WebSocket instance with the given URL and protocols.

##### Parameters

###### url

`string` \| `URL`

The URL to connect to.

###### protocols?

`string` \| `string`[]

The protocols to use for the connection.

##### Returns

`WebSocket`

##### Example

```ts
const ws = new WebSocket("wss://dev.local");
const ws = new WebSocket("wss://dev.local", ["proto1", "proto2"]);
```

#### CLOSED

> `readonly` **CLOSED**: `3`

The connection is closed or couldn't be opened

#### CLOSING

> `readonly` **CLOSING**: `2`

The connection is in the process of closing

#### CONNECTING

> `readonly` **CONNECTING**: `0`

The connection is not yet open

#### OPEN

> `readonly` **OPEN**: `1`

The connection is open and ready to communicate

#### prototype

> **prototype**: `WebSocket`
