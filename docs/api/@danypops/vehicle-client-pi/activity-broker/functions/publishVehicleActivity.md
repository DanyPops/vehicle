[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [activity-broker](../README.md) / publishVehicleActivity

# Function: publishVehicleActivity()

> **publishVehicleActivity**(`event`): `void`

Defined in: [packages/vehicle-client-pi/src/activity-broker.ts:61](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/activity-broker.ts#L61)

Publishes one activity event. Never throws -- neither a missing broker nor
a broker whose own publish() throws may affect the caller's control flow,
matching vstack's own "activity publication is best-effort" contract.

## Parameters

### event

[`VehicleActivityEvent`](../interfaces/VehicleActivityEvent.md)

## Returns

`void`
