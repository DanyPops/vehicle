[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-safety-registry](../README.md) / claimVehicleSafetyCommandName

# Function: claimVehicleSafetyCommandName()

> **claimVehicleSafetyCommandName**(`commandName`): `boolean`

Defined in: [packages/vehicle-client-pi/src/vehicle-safety-registry.ts:70](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety-registry.ts#L70)

Returns true exactly once per commandName across every vehicle-client-pi
copy in this process -- the caller that gets `true` is the one that
should actually call pi.registerCommand(commandName, ...); every other
caller relies on its contributed state showing up in the shared command
instead of registering a second, colliding command of its own.

## Parameters

### commandName

`string`

## Returns

`boolean`
