[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/armada](../../README.md) / [index](../README.md) / PlanOperation

# Type Alias: PlanOperation

> **PlanOperation** = \{ `kind`: `"install"`; `name`: [`VehicleName`](VehicleName.md); `specHash`: [`ManifestHash`](ManifestHash.md); \} \| \{ `kind`: `"update"`; `name`: [`VehicleName`](VehicleName.md); `specHash`: [`ManifestHash`](ManifestHash.md); \} \| \{ `kind`: `"start"` \| `"restart"`; `name`: [`VehicleName`](VehicleName.md); \}

Defined in: [fleet/planner.ts:7](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/fleet/planner.ts#L7)
