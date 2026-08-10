[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-pi](../README.md) / refreshVehicleToolAvailability

# Function: refreshVehicleToolAvailability()

> **refreshVehicleToolAvailability**(`pi`, `client`, `registered`, `options?`): `Promise`\<[`RegisteredPiVehicle`](../interfaces/RegisteredPiVehicle.md)\>

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:1084](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L1084)

Re-fetches the manifest and re-syncs which of this Vehicle's Pi tools are
currently active, without ever re-registering a tool this call has
already seen (Pi has no way to re-register under the same name). Any
operation present in the fresh manifest but not in `registered` is a
genuinely new operation and gets registered for the first time; every
previously-known tool just has its active/inactive state re-synced
against the operation's current `available` flag.

Callers decide their own refresh cadence (a maintenance-task-style
interval, a push notification, a session_start recheck); this function
only does one refresh pass and returns the updated bookkeeping to pass
into the next call.

## Parameters

### pi

`ExtensionAPI`

### client

`VehicleClient`

### registered

[`RegisteredPiVehicle`](../interfaces/RegisteredPiVehicle.md)

### options?

[`RegisterVehicleToolsOptions`](../interfaces/RegisterVehicleToolsOptions.md) = `{}`

## Returns

`Promise`\<[`RegisteredPiVehicle`](../interfaces/RegisteredPiVehicle.md)\>
