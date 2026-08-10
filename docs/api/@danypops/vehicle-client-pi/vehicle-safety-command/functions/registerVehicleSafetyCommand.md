[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-safety-command](../README.md) / registerVehicleSafetyCommand

# Function: registerVehicleSafetyCommand()

> **registerVehicleSafetyCommand**(`pi`, `policyStore`, `commandName?`): `void`

Defined in: [packages/vehicle-client-pi/src/vehicle-safety-command.ts:315](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety-command.ts#L315)

Registers `/safety` once per process -- every other vehicle-client-pi
copy in the session just contributes via the shared registry instead of
calling this a second time (see claimVehicleSafetyCommandName).

## Parameters

### pi

`ExtensionAPI`

### policyStore

[`VehicleSafetyPolicyStore`](../../vehicle-safety/classes/VehicleSafetyPolicyStore.md)

### commandName?

`string` = `"safety"`

## Returns

`void`
