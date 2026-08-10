[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-safety-registry](../README.md) / VehicleSafetyContributor

# Interface: VehicleSafetyContributor

Defined in: [packages/vehicle-client-pi/src/vehicle-safety-registry.ts:30](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety-registry.ts#L30)

## Properties

### resolve

> **resolve**: () => [`VehicleSafetyContribution`](VehicleSafetyContribution.md) \| `Promise`\<[`VehicleSafetyContribution`](VehicleSafetyContribution.md)\>

Defined in: [packages/vehicle-client-pi/src/vehicle-safety-registry.ts:34](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety-registry.ts#L34)

Called fresh on every /safety invocation, so the command always reflects the Vehicle's current registration state instead of a stale snapshot.

#### Returns

[`VehicleSafetyContribution`](VehicleSafetyContribution.md) \| `Promise`\<[`VehicleSafetyContribution`](VehicleSafetyContribution.md)\>

***

### source

> **source**: `string`

Defined in: [packages/vehicle-client-pi/src/vehicle-safety-registry.ts:32](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety-registry.ts#L32)

Stable per-Vehicle key (the manifest name) -- registering again under the same key replaces the prior contributor instead of duplicating it, so a refresh cycle doesn't accumulate stale copies of itself.
