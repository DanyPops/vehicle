[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client](../../README.md) / [vehicle-http-client](../README.md) / RemoteVehicleClientOptions

# Interface: RemoteVehicleClientOptions

Defined in: [packages/vehicle-client/src/vehicle-http-client.ts:52](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/vehicle-http-client.ts#L52)

## Properties

### baseUrl

> **baseUrl**: `string`

Defined in: [packages/vehicle-client/src/vehicle-http-client.ts:54](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/vehicle-http-client.ts#L54)

e.g. "http://127.0.0.1:4242" -- no trailing slash.

***

### fetch?

> `optional` **fetch?**: *typeof* `fetch`

Defined in: [packages/vehicle-client/src/vehicle-http-client.ts:57](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/vehicle-http-client.ts#L57)

Defaults to the global fetch. Injectable for tests.

***

### manifestCacheTtlMs?

> `optional` **manifestCacheTtlMs?**: `number`

Defined in: [packages/vehicle-client/src/vehicle-http-client.ts:67](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/vehicle-http-client.ts#L67)

Caches manifest() for this many milliseconds instead of hitting
/vehicle/manifest on every call. Default (undefined) is today's exact
behavior -- always fetch fresh, zero caching. The cache is a single
slot (one manifest per client, not keyed) and is invalidated
automatically the moment any non-"read"-effect invoke() through this
same client succeeds, since that's the only way this client's own
actions could have changed what the daemon now reports as available.

***

### pushUrl?

> `optional` **pushUrl?**: `string`

Defined in: [packages/vehicle-client/src/vehicle-http-client.ts:76](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/vehicle-http-client.ts#L76)

WebSocket URL for the push-invalidation channel this Vehicle's events
are bridged onto (see push-channel.ts / bridgeVehicleEventsToPushChannel
in vehicle-server). Only resolved the first time subscribe() is
actually called -- a client that never subscribes pays zero cost.
Defaults to baseUrl with http(s) swapped for ws(s) and "/push"
appended, matching startDaemon()'s own default pushPath.

***

### token

> **token**: `string`

Defined in: [packages/vehicle-client/src/vehicle-http-client.ts:55](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/vehicle-http-client.ts#L55)

***

### WebSocketImpl?

> `optional` **WebSocketImpl?**: \{(`url`, `options?`): `WebSocket`; (`url`, `protocols?`): `WebSocket`; `CLOSED`: `3`; `CLOSING`: `2`; `CONNECTING`: `0`; `OPEN`: `1`; `prototype`: `WebSocket`; \}

Defined in: [packages/vehicle-client/src/vehicle-http-client.ts:78](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/vehicle-http-client.ts#L78)

Defaults to the global WebSocket. Injectable for tests, passed straight through to connectPushChannel().

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
