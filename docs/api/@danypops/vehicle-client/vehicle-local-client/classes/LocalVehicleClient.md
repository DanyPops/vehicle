[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client](../../README.md) / [vehicle-local-client](../README.md) / LocalVehicleClient

# Class: LocalVehicleClient

Defined in: [packages/vehicle-client/src/vehicle-local-client.ts:28](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/vehicle-local-client.ts#L28)

A `VehicleClient` that calls a same-process VehicleRegistry directly, no
wire involved -- for a daemon calling its own registered operations, or
a host embedding a provider and its consumer in one process. Depends on
`@danypops/vehicle-server` only for `VehicleRegistry`'s type;
`RemoteVehicleClient` (`./http`) has no such dependency.

## Implements

- `VehicleClient`

## Constructors

### Constructor

> **new LocalVehicleClient**(`registry`): `LocalVehicleClient`

Defined in: [packages/vehicle-client/src/vehicle-local-client.ts:31](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/vehicle-local-client.ts#L31)

#### Parameters

##### registry

`VehicleRegistry`

#### Returns

`LocalVehicleClient`

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Defined in: [packages/vehicle-client/src/vehicle-local-client.ts:57](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/vehicle-local-client.ts#L57)

#### Returns

`Promise`\<`void`\>

#### Implementation of

`VehicleClient.close`

***

### invoke()

> **invoke**\<`Output`\>(`name`, `version`, `input`, `options?`): `Promise`\<`Output`\>

Defined in: [packages/vehicle-client/src/vehicle-local-client.ts:45](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/vehicle-local-client.ts#L45)

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

`VehicleInvocationOptions`

#### Returns

`Promise`\<`Output`\>

#### Implementation of

`VehicleClient.invoke`

***

### manifest()

> **manifest**(): `Promise`\<`VehicleManifest`\>

Defined in: [packages/vehicle-client/src/vehicle-local-client.ts:40](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/vehicle-local-client.ts#L40)

#### Returns

`Promise`\<`VehicleManifest`\>

#### Implementation of

`VehicleClient.manifest`

***

### subscribe()

> **subscribe**\<`Payload`\>(`name`, `version`, `handler`): `VehicleSubscription`

Defined in: [packages/vehicle-client/src/vehicle-local-client.ts:51](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/vehicle-local-client.ts#L51)

In-process subscription -- zero network, built directly on the registry's own subscribeLocal().

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
