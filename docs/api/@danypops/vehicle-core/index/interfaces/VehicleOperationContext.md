[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / VehicleOperationContext

# Interface: VehicleOperationContext\<Input\>

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:253](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L253)

## Type Parameters

### Input

`Input`

## Properties

### approvalCapability?

> `readonly` `optional` **approvalCapability?**: `string`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:263](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L263)

***

### correlationId?

> `readonly` `optional` **correlationId?**: `string`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:256](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L256)

***

### deadline

> `readonly` **deadline**: `number`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:258](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L258)

***

### expectedRevision?

> `readonly` `optional` **expectedRevision?**: `string` \| `number`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:262](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L262)

***

### idempotencyKey?

> `readonly` `optional` **idempotencyKey?**: `string`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:261](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L261)

***

### input

> `readonly` **input**: `Input`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:254](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L254)

***

### operationId

> `readonly` **operationId**: `string`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:255](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L255)

***

### permissions

> `readonly` **permissions**: readonly `string`[]

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:259](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L259)

***

### principal?

> `readonly` `optional` **principal?**: [`VehiclePrincipal`](VehiclePrincipal.md)

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:260](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L260)

***

### signal

> `readonly` **signal**: `AbortSignal`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:257](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L257)

***

### steerInputs?

> `readonly` `optional` **steerInputs?**: `AsyncIterable`\<`unknown`, `any`, `any`\>

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:265](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L265)

Set only for a job execution (VehicleJobStore.submit()); undefined for a plain invoke(). A handler that wants mid-flight input opts in with `for await (const input of context.steerInputs ?? [])`.

## Methods

### reportProgress()

> **reportProgress**(`progress`): `void`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:266](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L266)

#### Parameters

##### progress

`unknown`

#### Returns

`void`
