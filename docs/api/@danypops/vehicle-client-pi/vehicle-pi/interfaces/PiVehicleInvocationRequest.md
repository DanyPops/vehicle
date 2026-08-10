[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-pi](../README.md) / PiVehicleInvocationRequest

# Interface: PiVehicleInvocationRequest

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:70](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L70)

## Properties

### context

> `readonly` **context**: `ExtensionContext`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:76](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L76)

***

### descriptor

> `readonly` **descriptor**: `VehicleOperationDescriptor`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:71](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L71)

***

### input

> `readonly` **input**: `unknown`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:75](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L75)

***

### manifest

> `readonly` **manifest**: `VehicleManifest`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:72](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L72)

***

### onUpdate?

> `readonly` `optional` **onUpdate?**: `AgentToolUpdateCallback`\<[`PiVehicleToolDetails`](PiVehicleToolDetails.md)\>

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:80](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L80)

The tool call's own progress-update callback -- lets an interactiveFollowUp report an in-progress status (e.g. "waiting for a human answer") the same way the primary invoke()'s own onProgress does.

***

### signal?

> `readonly` `optional` **signal?**: `AbortSignal`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:78](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L78)

The tool call's own cancellation signal -- present on every request; here for interactiveFollowUps (or any future consumer) to make its own extra round trip abortable too.

***

### toolCallId

> `readonly` **toolCallId**: `string`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:74](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L74)

***

### toolName

> `readonly` **toolName**: `string`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:73](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L73)
