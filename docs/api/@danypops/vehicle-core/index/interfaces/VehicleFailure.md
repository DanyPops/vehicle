[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / VehicleFailure

# Interface: VehicleFailure

Defined in: [packages/vehicle-core/src/vehicle-errors.ts:41](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-errors.ts#L41)

## Properties

### category

> `readonly` **category**: [`VehicleFailureCategory`](../type-aliases/VehicleFailureCategory.md)

Defined in: [packages/vehicle-core/src/vehicle-errors.ts:43](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-errors.ts#L43)

***

### causeMessage?

> `readonly` `optional` **causeMessage?**: `string`

Defined in: [packages/vehicle-core/src/vehicle-errors.ts:51](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-errors.ts#L51)

The underlying cause's own message, bounded (never a full stack trace). Only set when the throw site opts into exposeCause.

***

### code

> `readonly` **code**: `string`

Defined in: [packages/vehicle-core/src/vehicle-errors.ts:42](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-errors.ts#L42)

***

### details?

> `readonly` `optional` **details?**: [`JsonValue`](../type-aliases/JsonValue.md)

Defined in: [packages/vehicle-core/src/vehicle-errors.ts:48](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-errors.ts#L48)

***

### message

> `readonly` **message**: `string`

Defined in: [packages/vehicle-core/src/vehicle-errors.ts:44](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-errors.ts#L44)

***

### operationId?

> `readonly` `optional` **operationId?**: `string`

Defined in: [packages/vehicle-core/src/vehicle-errors.ts:49](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-errors.ts#L49)

***

### recovery?

> `readonly` `optional` **recovery?**: [`VehicleRecovery`](VehicleRecovery.md)

Defined in: [packages/vehicle-core/src/vehicle-errors.ts:47](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-errors.ts#L47)

***

### retryable

> `readonly` **retryable**: `boolean`

Defined in: [packages/vehicle-core/src/vehicle-errors.ts:45](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-errors.ts#L45)

***

### retryAfterMs?

> `readonly` `optional` **retryAfterMs?**: `number`

Defined in: [packages/vehicle-core/src/vehicle-errors.ts:46](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-errors.ts#L46)
