[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-monolith](../README.md) / createMonolithVehicle

# Function: createMonolithVehicle()

> **createMonolithVehicle**(`pi`, `identity`, `register`, `options?`): `Promise`\<[`MonolithVehicle`](../interfaces/MonolithVehicle.md)\>

Defined in: [packages/vehicle-client-pi/src/vehicle-monolith.ts:32](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-monolith.ts#L32)

`identity` is the same `{name, version, description}` a VehicleRegistry
constructor already takes. `register` gets the fresh registry to call
`.register(owner, binding)` on -- the exact same operation-definition
shape a real daemon-backed provider uses, so a Monolith provider can be
upgraded to a real daemon later with zero change to its own operations.

## Parameters

### pi

`ExtensionAPI`

### identity

`VehicleManifestIdentity`

### register

(`registry`) => `void`

### options?

[`RegisterVehicleToolsOptions`](../../vehicle-pi/interfaces/RegisterVehicleToolsOptions.md) = `{}`

## Returns

`Promise`\<[`MonolithVehicle`](../interfaces/MonolithVehicle.md)\>
