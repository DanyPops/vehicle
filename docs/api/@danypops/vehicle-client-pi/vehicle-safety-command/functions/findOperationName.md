[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-safety-command](../README.md) / findOperationName

# Function: findOperationName()

> **findOperationName**(`contributions`, `row`): `string`

Defined in: [packages/vehicle-client-pi/src/vehicle-safety-command.ts:77](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety-command.ts#L77)

Resolves a row's real operationName (not its projected toolName) so the policy store keys on the same identity registerVehicleTools() checks against.

## Parameters

### contributions

readonly [`VehicleSafetyContribution`](../../vehicle-safety-registry/interfaces/VehicleSafetyContribution.md)[]

### row

`Pick`\<[`VehicleSafetyRow`](../interfaces/VehicleSafetyRow.md), `"vehicle"` \| `"command"`\>

## Returns

`string`
