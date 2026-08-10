[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [vehicle-http-provider](../README.md) / VehicleHttpProviderOptions

# Interface: VehicleHttpProviderOptions

Defined in: [packages/vehicle-server/src/vehicle-http-provider.ts:39](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-http-provider.ts#L39)

## Properties

### logger?

> `optional` **logger?**: [`Logger`](../../logging/interfaces/Logger.md)

Defined in: [packages/vehicle-server/src/vehicle-http-provider.ts:50](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-http-provider.ts#L50)

Defaults to a no-op logger. Without one, a failed invocation is sanitized
into a wire-safe VehicleFailure (code/category/message only, per this
house's own "never leak internals over the wire" discipline) and returned
to the caller -- but the real cause (a handler's own thrown error,
including its stack) is otherwise discarded the moment this function
returns, unrecoverable from any log. Pass a real logger to keep it.

***

### registry

> **registry**: [`VehicleRegistry`](../../vehicle-registry/classes/VehicleRegistry.md)

Defined in: [packages/vehicle-server/src/vehicle-http-provider.ts:40](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-http-provider.ts#L40)

***

### token

> **token**: `string`

Defined in: [packages/vehicle-server/src/vehicle-http-provider.ts:41](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-http-provider.ts#L41)
