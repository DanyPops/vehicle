[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / VehicleErrorOptions

# Interface: VehicleErrorOptions

Defined in: [packages/vehicle-core/src/vehicle-errors.ts:54](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-errors.ts#L54)

## Properties

### category

> `readonly` **category**: [`VehicleFailureCategory`](../type-aliases/VehicleFailureCategory.md)

Defined in: [packages/vehicle-core/src/vehicle-errors.ts:55](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-errors.ts#L55)

***

### cause?

> `readonly` `optional` **cause?**: `unknown`

Defined in: [packages/vehicle-core/src/vehicle-errors.ts:61](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-errors.ts#L61)

***

### details?

> `readonly` `optional` **details?**: [`JsonValue`](../type-aliases/JsonValue.md)

Defined in: [packages/vehicle-core/src/vehicle-errors.ts:59](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-errors.ts#L59)

***

### exposeCause?

> `readonly` `optional` **exposeCause?**: `boolean`

Defined in: [packages/vehicle-core/src/vehicle-errors.ts:63](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-errors.ts#L63)

Includes cause's message in toFailure().causeMessage. Default false -- an arbitrary cause could carry a credential or internal detail.

***

### operationId?

> `readonly` `optional` **operationId?**: `string`

Defined in: [packages/vehicle-core/src/vehicle-errors.ts:60](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-errors.ts#L60)

***

### recovery?

> `readonly` `optional` **recovery?**: [`VehicleRecovery`](VehicleRecovery.md)

Defined in: [packages/vehicle-core/src/vehicle-errors.ts:58](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-errors.ts#L58)

***

### retryable?

> `readonly` `optional` **retryable?**: `boolean`

Defined in: [packages/vehicle-core/src/vehicle-errors.ts:56](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-errors.ts#L56)

***

### retryAfterMs?

> `readonly` `optional` **retryAfterMs?**: `number`

Defined in: [packages/vehicle-core/src/vehicle-errors.ts:57](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-errors.ts#L57)
