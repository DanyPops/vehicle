[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-safety](../README.md) / createFileVehicleSafetyPersistence

# Function: createFileVehicleSafetyPersistence()

> **createFileVehicleSafetyPersistence**(`options`): [`VehicleSafetyPersistenceAdapter`](../interfaces/VehicleSafetyPersistenceAdapter.md)

Defined in: [packages/vehicle-client-pi/src/vehicle-safety.ts:90](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety.ts#L90)

Same shape as vehicle-server's createFileVehicleSchedulePersistence -- a corrupt or foreign file on disk never breaks restore, it's just discarded in favor of starting empty.

## Parameters

### options

[`CreateFileVehicleSafetyPersistenceOptions`](../interfaces/CreateFileVehicleSafetyPersistenceOptions.md)

## Returns

[`VehicleSafetyPersistenceAdapter`](../interfaces/VehicleSafetyPersistenceAdapter.md)
