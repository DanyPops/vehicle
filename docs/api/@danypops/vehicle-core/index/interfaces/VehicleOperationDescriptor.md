[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / VehicleOperationDescriptor

# Interface: VehicleOperationDescriptor

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:197](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L197)

The serializable half of a Vehicle operation -- name, version, schemas,
ownership-implying permissions, effect classification, idempotency,
streaming/long-running capability, request/response limits, and declared
[VehicleFailureDescriptor](VehicleFailureDescriptor.md) failure modes. Kept separate from the
executable [VehicleOperationHandler](../type-aliases/VehicleOperationHandler.md) on purpose: a manifest, a Pi
tool projection, or a client's own capability check can all inspect this
shape without ever touching (or needing to trust) the implementation
behind it.

## Extended by

- [`VehicleManifestOperation`](VehicleManifestOperation.md)

## Properties

### background?

> `readonly` `optional` **background?**: [`VehicleBackgroundCapability`](VehicleBackgroundCapability.md)

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:210](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L210)

***

### description

> `readonly` **description**: `string`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:200](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L200)

***

### effect

> `readonly` **effect**: [`VehicleEffect`](../type-aliases/VehicleEffect.md)

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:204](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L204)

***

### errors

> `readonly` **errors**: readonly [`VehicleFailureDescriptor`](VehicleFailureDescriptor.md)[]

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:209](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L209)

***

### idempotency

> `readonly` **idempotency**: [`VehicleIdempotency`](../type-aliases/VehicleIdempotency.md)

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:205](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L205)

***

### inputSchema

> `readonly` **inputSchema**: [`JsonSchema`](../type-aliases/JsonSchema.md)

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:201](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L201)

***

### limits

> `readonly` **limits**: [`VehicleLimits`](VehicleLimits.md)

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:208](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L208)

***

### longRunning

> `readonly` **longRunning**: `boolean`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:207](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L207)

***

### name

> `readonly` **name**: `string`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:198](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L198)

***

### outputSchema

> `readonly` **outputSchema**: [`JsonSchema`](../type-aliases/JsonSchema.md)

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:202](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L202)

***

### permissions

> `readonly` **permissions**: readonly `string`[]

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:203](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L203)

***

### streaming

> `readonly` **streaming**: `boolean`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:206](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L206)

***

### version

> `readonly` **version**: `number`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:199](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L199)
