[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-safety](../README.md) / VehicleSafetyClassificationInput

# Interface: VehicleSafetyClassificationInput

Defined in: [packages/vehicle-client-pi/src/vehicle-safety.ts:15](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety.ts#L15)

## Properties

### effect

> `readonly` **effect**: `VehicleEffect`

Defined in: [packages/vehicle-client-pi/src/vehicle-safety.ts:17](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety.ts#L17)

***

### override?

> `readonly` `optional` **override?**: [`VehicleSafetyState`](../type-aliases/VehicleSafetyState.md)

Defined in: [packages/vehicle-client-pi/src/vehicle-safety.ts:20](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety.ts#L20)

***

### permissionsSatisfied

> `readonly` **permissionsSatisfied**: `boolean`

Defined in: [packages/vehicle-client-pi/src/vehicle-safety.ts:16](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety.ts#L16)

***

### requireApprovalForEffects?

> `readonly` `optional` **requireApprovalForEffects?**: `ReadonlySet`\<`VehicleEffect`\>

Defined in: [packages/vehicle-client-pi/src/vehicle-safety.ts:19](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety.ts#L19)

Defaults to DEFAULT_APPROVAL_EFFECTS, mirroring VehicleRegistry's own default -- a caller whose Vehicle server was configured with a different requireApprovalForEffects set should pass the same set here so /safety's "ask" classification matches reality.
