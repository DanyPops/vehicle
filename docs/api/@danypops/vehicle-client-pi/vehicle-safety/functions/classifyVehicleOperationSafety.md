[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-safety](../README.md) / classifyVehicleOperationSafety

# Function: classifyVehicleOperationSafety()

> **classifyVehicleOperationSafety**(`input`): [`VehicleSafetyState`](../type-aliases/VehicleSafetyState.md)

Defined in: [packages/vehicle-client-pi/src/vehicle-safety.ts:32](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety.ts#L32)

Resolves an operation's real state. Precedence: an explicit per-operation
override always wins (a human's own /safety decision), then the
effect-level default, then a missing permission blocks. An override
winning over a permission-based block is deliberate: it only changes
local visibility/gating, never what the server actually authorizes at
invoke time -- invoking a permission-blocked operation a human overrode
to "allow" still fails server-side with permission-denied.

## Parameters

### input

[`VehicleSafetyClassificationInput`](../interfaces/VehicleSafetyClassificationInput.md)

## Returns

[`VehicleSafetyState`](../type-aliases/VehicleSafetyState.md)
