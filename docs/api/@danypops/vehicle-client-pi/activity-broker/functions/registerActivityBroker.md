[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [activity-broker](../README.md) / registerActivityBroker

# Function: registerActivityBroker()

> **registerActivityBroker**(`broker`): `void`

Defined in: [packages/vehicle-client-pi/src/activity-broker.ts:48](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/activity-broker.ts#L48)

Registers this process's activity broker. A second call replaces the first -- callers coordinate ownership themselves, matching the plain globalThis-symbol convention this pattern is built on.

## Parameters

### broker

[`VehicleActivityBroker`](../interfaces/VehicleActivityBroker.md)

## Returns

`void`
