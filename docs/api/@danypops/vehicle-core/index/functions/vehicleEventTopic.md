[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / vehicleEventTopic

# Function: vehicleEventTopic()

> **vehicleEventTopic**(`name`, `version`): `string`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:368](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L368)

The wire topic name a bridge (bridgeVehicleEventsToPushChannel, in
vehicle-server) publishes an event under, and a subscriber
(RemoteVehicleClient.subscribe()) subscribes to -- one shared naming
function in vehicle-core so both sides can never drift apart on the
convention, the same failure mode this primitive exists to prevent
providers from reinventing per-project.

## Parameters

### name

`string`

### version

`number`

## Returns

`string`
