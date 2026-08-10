[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-pi](../README.md) / VehicleOperationInvocationParams

# Interface: VehicleOperationInvocationParams

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:648](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L648)

## Properties

### client

> `readonly` **client**: `VehicleClient`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:649](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L649)

***

### context

> `readonly` **context**: `ExtensionContext`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:656](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L656)

***

### descriptor

> `readonly` **descriptor**: `VehicleOperationDescriptor`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:651](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L651)

***

### input

> `readonly` **input**: `unknown`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:655](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L655)

***

### manifest

> `readonly` **manifest**: `VehicleManifest`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:650](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L650)

***

### onUpdate?

> `readonly` `optional` **onUpdate?**: `AgentToolUpdateCallback`\<[`PiVehicleToolDetails`](PiVehicleToolDetails.md)\>

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:658](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L658)

***

### options

> `readonly` **options**: [`RegisterVehicleToolsOptions`](RegisterVehicleToolsOptions.md)

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:659](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L659)

***

### presentationProjector?

> `readonly` `optional` **presentationProjector?**: [`PiVehiclePresentationProjector`](PiVehiclePresentationProjector.md)

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:661](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L661)

Internal resolved contract. Omitted preserves standalone/custom legacy {vehicle, output} behavior.

***

### signal?

> `readonly` `optional` **signal?**: `AbortSignal`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:657](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L657)

***

### toolCallId

> `readonly` **toolCallId**: `string`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:654](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L654)

***

### toolName

> `readonly` **toolName**: `string`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:653](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L653)

The name a consumer's own tool call is presented under -- purely for identity/telemetry; does not have to be descriptor's own projected Pi tool name (a consolidated multi-action tool passes its own single name for every sub-action it dispatches).
