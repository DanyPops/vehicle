[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / VehicleManifestOperation

# Interface: VehicleManifestOperation

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:292](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L292)

A manifest's own view of an operation: the static descriptor plus
whether it's currently usable on this particular server instance right
now. Availability is a runtime property of a live registry (a
credential got configured or removed), never baked into the static
descriptor defineVehicleOperation() produces -- two manifest() calls
against the same registry can report different availability for the
exact same descriptor.

## Extends

- [`VehicleOperationDescriptor`](VehicleOperationDescriptor.md)

## Properties

### available

> `readonly` **available**: `boolean`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:293](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L293)

***

### background?

> `readonly` `optional` **background?**: [`VehicleBackgroundCapability`](VehicleBackgroundCapability.md)

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:210](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L210)

#### Inherited from

[`VehicleOperationDescriptor`](VehicleOperationDescriptor.md).[`background`](VehicleOperationDescriptor.md#background)

***

### description

> `readonly` **description**: `string`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:200](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L200)

#### Inherited from

[`VehicleOperationDescriptor`](VehicleOperationDescriptor.md).[`description`](VehicleOperationDescriptor.md#description)

***

### effect

> `readonly` **effect**: [`VehicleEffect`](../type-aliases/VehicleEffect.md)

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:204](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L204)

#### Inherited from

[`VehicleOperationDescriptor`](VehicleOperationDescriptor.md).[`effect`](VehicleOperationDescriptor.md#effect)

***

### errors

> `readonly` **errors**: readonly [`VehicleFailureDescriptor`](VehicleFailureDescriptor.md)[]

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:209](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L209)

#### Inherited from

[`VehicleOperationDescriptor`](VehicleOperationDescriptor.md).[`errors`](VehicleOperationDescriptor.md#errors)

***

### idempotency

> `readonly` **idempotency**: [`VehicleIdempotency`](../type-aliases/VehicleIdempotency.md)

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:205](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L205)

#### Inherited from

[`VehicleOperationDescriptor`](VehicleOperationDescriptor.md).[`idempotency`](VehicleOperationDescriptor.md#idempotency)

***

### inputSchema

> `readonly` **inputSchema**: [`JsonSchema`](../type-aliases/JsonSchema.md)

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:201](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L201)

#### Inherited from

[`VehicleOperationDescriptor`](VehicleOperationDescriptor.md).[`inputSchema`](VehicleOperationDescriptor.md#inputschema)

***

### limits

> `readonly` **limits**: [`VehicleLimits`](VehicleLimits.md)

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:208](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L208)

#### Inherited from

[`VehicleOperationDescriptor`](VehicleOperationDescriptor.md).[`limits`](VehicleOperationDescriptor.md#limits)

***

### longRunning

> `readonly` **longRunning**: `boolean`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:207](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L207)

#### Inherited from

[`VehicleOperationDescriptor`](VehicleOperationDescriptor.md).[`longRunning`](VehicleOperationDescriptor.md#longrunning)

***

### name

> `readonly` **name**: `string`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:198](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L198)

#### Inherited from

[`VehicleOperationDescriptor`](VehicleOperationDescriptor.md).[`name`](VehicleOperationDescriptor.md#name)

***

### outputSchema

> `readonly` **outputSchema**: [`JsonSchema`](../type-aliases/JsonSchema.md)

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:202](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L202)

#### Inherited from

[`VehicleOperationDescriptor`](VehicleOperationDescriptor.md).[`outputSchema`](VehicleOperationDescriptor.md#outputschema)

***

### permissions

> `readonly` **permissions**: readonly `string`[]

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:203](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L203)

#### Inherited from

[`VehicleOperationDescriptor`](VehicleOperationDescriptor.md).[`permissions`](VehicleOperationDescriptor.md#permissions)

***

### streaming

> `readonly` **streaming**: `boolean`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:206](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L206)

#### Inherited from

[`VehicleOperationDescriptor`](VehicleOperationDescriptor.md).[`streaming`](VehicleOperationDescriptor.md#streaming)

***

### unavailableReason?

> `readonly` `optional` **unavailableReason?**: `string`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:294](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L294)

***

### version

> `readonly` **version**: `number`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:199](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L199)

#### Inherited from

[`VehicleOperationDescriptor`](VehicleOperationDescriptor.md).[`version`](VehicleOperationDescriptor.md#version)
