[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [client-diagnostics](../README.md) / ClassificationFailureEvent

# Interface: ClassificationFailureEvent

Defined in: [packages/vehicle-client-pi/src/client-diagnostics.ts:29](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/client-diagnostics.ts#L29)

## Properties

### internalFailureKind

> `readonly` **internalFailureKind**: `string`

Defined in: [packages/vehicle-client-pi/src/client-diagnostics.ts:34](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/client-diagnostics.ts#L34)

What actually went wrong while classifying it -- sanitizedFailure() itself must never throw this uncaught again.

***

### internalFailureMessage

> `readonly` **internalFailureMessage**: `string`

Defined in: [packages/vehicle-client-pi/src/client-diagnostics.ts:35](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/client-diagnostics.ts#L35)

***

### originalErrorKind

> `readonly` **originalErrorKind**: `string`

Defined in: [packages/vehicle-client-pi/src/client-diagnostics.ts:32](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/client-diagnostics.ts#L32)

The original error's own constructor name (e.g. "TypeError"), never its message/stack -- see the file-level doc comment on content-safety.

***

### ts

> `readonly` **ts**: `string`

Defined in: [packages/vehicle-client-pi/src/client-diagnostics.ts:30](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/client-diagnostics.ts#L30)
