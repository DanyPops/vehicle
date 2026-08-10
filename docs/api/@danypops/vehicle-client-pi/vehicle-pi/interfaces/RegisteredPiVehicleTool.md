[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-pi](../README.md) / RegisteredPiVehicleTool

# Interface: RegisteredPiVehicleTool

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:274](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L274)

## Properties

### available

> `readonly` **available**: `boolean`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:279](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L279)

This operation's availability as of the manifest fetch that produced this entry -- see refreshVehicleToolAvailability for keeping it current.

***

### effect

> `readonly` **effect**: `VehicleEffect`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:282](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L282)

***

### operationName

> `readonly` **operationName**: `string`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:276](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L276)

***

### operationVersion

> `readonly` **operationVersion**: `number`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:277](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L277)

***

### permissionsSatisfied

> `readonly` **permissionsSatisfied**: `boolean`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:281](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L281)

Whether options.permissions, as of this registration/refresh, actually covers descriptor.permissions -- see permissionsSatisfied(). A tool is only ever active when both this and `available` are true.

***

### safetyState

> `readonly` **safetyState**: [`VehicleSafetyState`](../../vehicle-safety/type-aliases/VehicleSafetyState.md)

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:284](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L284)

Resolved allow/ask/blocked -- see classifyVehicleOperationSafety(). A tool is only ever active when `available` is true and this isn't "blocked".

***

### toolName

> `readonly` **toolName**: `string`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:275](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L275)
