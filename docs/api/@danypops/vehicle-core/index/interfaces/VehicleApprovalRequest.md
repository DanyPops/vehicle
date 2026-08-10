[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / VehicleApprovalRequest

# Interface: VehicleApprovalRequest

Defined in: [packages/vehicle-core/src/vehicle-approvals.ts:31](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-approvals.ts#L31)

Emitted (as a Vehicle Event) the moment a gated-effect invoke() has no valid capability -- durable-first, before any interactive prompt is attempted.

## Properties

### effect

> `readonly` **effect**: [`VehicleEffect`](../type-aliases/VehicleEffect.md)

Defined in: [packages/vehicle-core/src/vehicle-approvals.ts:35](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-approvals.ts#L35)

***

### expiresAt

> `readonly` **expiresAt**: `number`

Defined in: [packages/vehicle-core/src/vehicle-approvals.ts:38](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-approvals.ts#L38)

***

### inputHash

> `readonly` **inputHash**: `string`

Defined in: [packages/vehicle-core/src/vehicle-approvals.ts:40](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-approvals.ts#L40)

sha256 hex of the exact input the gated invoke() attempted -- a minted capability is scoped to this input, not just the operation.

***

### operationName

> `readonly` **operationName**: `string`

Defined in: [packages/vehicle-core/src/vehicle-approvals.ts:33](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-approvals.ts#L33)

***

### operationVersion

> `readonly` **operationVersion**: `number`

Defined in: [packages/vehicle-core/src/vehicle-approvals.ts:34](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-approvals.ts#L34)

***

### principal?

> `readonly` `optional` **principal?**: [`VehiclePrincipal`](VehiclePrincipal.md)

Defined in: [packages/vehicle-core/src/vehicle-approvals.ts:36](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-approvals.ts#L36)

***

### requestedAt

> `readonly` **requestedAt**: `number`

Defined in: [packages/vehicle-core/src/vehicle-approvals.ts:37](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-approvals.ts#L37)

***

### requestId

> `readonly` **requestId**: `string`

Defined in: [packages/vehicle-core/src/vehicle-approvals.ts:32](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-approvals.ts#L32)
