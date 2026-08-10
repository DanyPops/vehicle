[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client](../../README.md) / [vehicle-http-client](../README.md) / RemoteVehicleClient

# Class: RemoteVehicleClient

Defined in: [packages/vehicle-client/src/vehicle-http-client.ts:109](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/vehicle-http-client.ts#L109)

A `VehicleClient` that talks to a remote daemon's
`@danypops/vehicle-server`'s `./http` provider over the same
Bearer-authenticated loopback transport every Vehicle server uses --
preserving `LocalVehicleClient`'s exact semantics over the wire (every
`VehicleInvocationOptions` field sent in the request body, a relative
`deadlineMs`, cancellation aborting the underlying fetch AND
best-effort notifying the provider's `/vehicle/cancel`, progress via SSE
when `onProgress` is set, and a `VehicleError` round-tripping with its
original code/category/details rather than becoming a generic HTTP
error) -- so a daemon-backed Pi extension can project a remote Vehicle
through `@danypops/vehicle-client-pi` exactly as it would a local one.

## Implements

- `VehicleClient`

## Constructors

### Constructor

> **new RemoteVehicleClient**(`options`): `RemoteVehicleClient`

Defined in: [packages/vehicle-client/src/vehicle-http-client.ts:114](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/vehicle-http-client.ts#L114)

#### Parameters

##### options

[`RemoteVehicleClientOptions`](../interfaces/RemoteVehicleClientOptions.md)

#### Returns

`RemoteVehicleClient`

## Methods

### cancel()

> **cancel**(`operationId`): `Promise`\<`void`\>

Defined in: [packages/vehicle-client/src/vehicle-http-client.ts:201](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/vehicle-http-client.ts#L201)

Best-effort: notifies the provider to abort a still-in-flight operation. The local fetch's own AbortSignal already stops this client's wait regardless of whether this succeeds.

#### Parameters

##### operationId

`string`

#### Returns

`Promise`\<`void`\>

***

### close()

> **close**(): `Promise`\<`void`\>

Defined in: [packages/vehicle-client/src/vehicle-http-client.ts:213](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/vehicle-http-client.ts#L213)

#### Returns

`Promise`\<`void`\>

#### Implementation of

`VehicleClient.close`

***

### invoke()

> **invoke**\<`Output`\>(`name`, `version`, `input`, `options?`): `Promise`\<`Output`\>

Defined in: [packages/vehicle-client/src/vehicle-http-client.ts:134](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/vehicle-http-client.ts#L134)

#### Type Parameters

##### Output

`Output` = `unknown`

#### Parameters

##### name

`string`

##### version

`number`

##### input

`unknown`

##### options?

`VehicleInvocationOptions` = `{}`

#### Returns

`Promise`\<`Output`\>

#### Implementation of

`VehicleClient.invoke`

***

### manifest()

> **manifest**(): `Promise`\<`VehicleManifest`\>

Defined in: [packages/vehicle-client/src/vehicle-http-client.ts:118](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/vehicle-http-client.ts#L118)

#### Returns

`Promise`\<`VehicleManifest`\>

#### Implementation of

`VehicleClient.manifest`

***

### subscribe()

> **subscribe**\<`Payload`\>(`name`, `version`, `handler`): `VehicleSubscription`

Defined in: [packages/vehicle-client/src/vehicle-http-client.ts:185](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/vehicle-http-client.ts#L185)

Subscribes to one declared Vehicle event over the daemon's push channel,
with the same reconnect/backoff/jitter/heartbeat resilience every other
connectPushChannel() consumer gets -- not a new hand-rolled WebSocket.
Each call opens its own connection (one per subscription, not shared/
pooled) so close() on the returned VehicleSubscription is unambiguous.

#### Type Parameters

##### Payload

`Payload` = `unknown`

#### Parameters

##### name

`string`

##### version

`number`

##### handler

`VehicleEventHandler`\<`Payload`\>

#### Returns

`VehicleSubscription`
