[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/armada](../../README.md) / [index](../README.md) / ExecuteCleanupRequest

# Interface: ExecuteCleanupRequest

Defined in: [fleet/cleanup.ts:62](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/fleet/cleanup.ts#L62)

## Properties

### approval

> `readonly` **approval**: `string`

Defined in: [fleet/cleanup.ts:64](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/fleet/cleanup.ts#L64)

***

### currentProcesses

> `readonly` **currentProcesses**: () => `Promise`\<readonly [`ObservedProcess`](ObservedProcess.md)[]\>

Defined in: [fleet/cleanup.ts:68](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/fleet/cleanup.ts#L68)

#### Returns

`Promise`\<readonly [`ObservedProcess`](ObservedProcess.md)[]\>

***

### handle

> `readonly` **handle**: [`ObservedVehicleHandle`](ObservedVehicleHandle.md) \| `undefined`

Defined in: [fleet/cleanup.ts:67](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/fleet/cleanup.ts#L67)

***

### managedPid

> `readonly` **managedPid**: `number` \| `undefined`

Defined in: [fleet/cleanup.ts:66](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/fleet/cleanup.ts#L66)

***

### plan

> `readonly` **plan**: [`CleanupPlan`](CleanupPlan.md)

Defined in: [fleet/cleanup.ts:63](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/fleet/cleanup.ts#L63)

***

### terminate

> `readonly` **terminate**: (`pid`) => `Promise`\<[`NativeOperationOutcome`](../type-aliases/NativeOperationOutcome.md)\>

Defined in: [fleet/cleanup.ts:69](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/fleet/cleanup.ts#L69)

#### Parameters

##### pid

`number`

#### Returns

`Promise`\<[`NativeOperationOutcome`](../type-aliases/NativeOperationOutcome.md)\>

***

### vehicle

> `readonly` **vehicle**: [`VehicleSpec`](VehicleSpec.md)

Defined in: [fleet/cleanup.ts:65](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/fleet/cleanup.ts#L65)
