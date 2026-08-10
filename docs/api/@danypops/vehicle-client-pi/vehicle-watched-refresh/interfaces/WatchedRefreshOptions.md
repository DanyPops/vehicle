[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-watched-refresh](../README.md) / WatchedRefreshOptions

# Interface: WatchedRefreshOptions

Defined in: [packages/vehicle-client-pi/src/vehicle-watched-refresh.ts:54](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-watched-refresh.ts#L54)

## Properties

### maxRenewAttempts?

> `optional` **maxRenewAttempts?**: `number`

Defined in: [packages/vehicle-client-pi/src/vehicle-watched-refresh.ts:86](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-watched-refresh.ts#L86)

Caps consecutive renewal attempts (identity-changed, reported-unknown-watch, or a closed push channel) before giving up on push for the rest of this session and reporting "timed-out" -- polling continues regardless, since it never depended on push in the first place. Defaults to 5.

***

### onStateChange?

> `optional` **onStateChange?**: (`state`) => `void`

Defined in: [packages/vehicle-client-pi/src/vehicle-watched-refresh.ts:88](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-watched-refresh.ts#L88)

Every state transition, in order. Optional -- a caller that doesn't need a "refreshing forever" guard can omit it with zero behavior change.

#### Parameters

##### state

[`WatchedRefreshState`](../type-aliases/WatchedRefreshState.md)

#### Returns

`void`

***

### pollIntervalMs

> **pollIntervalMs**: `number`

Defined in: [packages/vehicle-client-pi/src/vehicle-watched-refresh.ts:82](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-watched-refresh.ts#L82)

***

### refresh

> **refresh**: () => `void` \| `Promise`\<`void`\>

Defined in: [packages/vehicle-client-pi/src/vehicle-watched-refresh.ts:81](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-watched-refresh.ts#L81)

Does the real refresh (e.g. re-fetch and re-render). Called on every push notification for this watch's own topic, and on every poll tick regardless of push state. Thrown/rejected errors are the caller's own concern -- not swallowed here, unlike registerVehicleStatusRefresh's status-bar use case, since a widget's own refresh() already has its own established error handling (e.g. TaskOverlay's try/catch around callService).

#### Returns

`void` \| `Promise`\<`void`\>

***

### resolvePushTarget

> **resolvePushTarget**: () => [`VehiclePushTarget`](VehiclePushTarget.md) \| `undefined`

Defined in: [packages/vehicle-client-pi/src/vehicle-watched-refresh.ts:79](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-watched-refresh.ts#L79)

Resolves the push channel's current {url, token} -- re-invoked on
every reconnect attempt (a daemon rebinds a new random port on every
restart). Returning undefined behaves like watch() returning
undefined: push connection stays down, polling keeps this widget
refreshed regardless. Its own `url` doubles as this daemon instance's
identity: a change since the current watch was established forces
renewal (see the file-level doc comment).

#### Returns

[`VehiclePushTarget`](VehiclePushTarget.md) \| `undefined`

***

### unwatch?

> `optional` **unwatch?**: (`target`) => `Promise`\<`void`\>

Defined in: [packages/vehicle-client-pi/src/vehicle-watched-refresh.ts:69](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-watched-refresh.ts#L69)

Best-effort release of a watch this widget no longer needs (e.g. the daemon's own
"${name}.unwatch" operation, see createVehicleWatchOperations in vehicle-server) --
called before replacing a stale watch. A rejection is swallowed: the daemon instance
that issued the old watchId may already be gone, in which case there is nothing to
release in the first place.

#### Parameters

##### target

[`VehicleWatchTarget`](VehicleWatchTarget.md)

#### Returns

`Promise`\<`void`\>

***

### watch

> **watch**: () => `Promise`\<[`VehicleWatchTarget`](VehicleWatchTarget.md) \| `undefined`\>

Defined in: [packages/vehicle-client-pi/src/vehicle-watched-refresh.ts:61](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-watched-refresh.ts#L61)

Calls the daemon's own "${name}.watch" operation and returns its
{watchId, topic} output. Return undefined when the daemon isn't
reachable yet (mirrors subscribeTaskPushChannel's own tolerance) --
the next poll tick retries automatically.

#### Returns

`Promise`\<[`VehicleWatchTarget`](VehicleWatchTarget.md) \| `undefined`\>

***

### watchTimeoutMs?

> `optional` **watchTimeoutMs?**: `number`

Defined in: [packages/vehicle-client-pi/src/vehicle-watched-refresh.ts:84](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-watched-refresh.ts#L84)

Bounds a single watch() attempt -- a hung call degrades to polling and reports "resolver-failed" instead of leaving state stuck at "connecting" forever. Defaults to 5000.

***

### WebSocketImpl?

> `optional` **WebSocketImpl?**: \{(`url`, `options?`): `WebSocket`; (`url`, `protocols?`): `WebSocket`; `CLOSED`: `3`; `CLOSING`: `2`; `CONNECTING`: `0`; `OPEN`: `1`; `prototype`: `WebSocket`; \}

Defined in: [packages/vehicle-client-pi/src/vehicle-watched-refresh.ts:90](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-watched-refresh.ts#L90)

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
