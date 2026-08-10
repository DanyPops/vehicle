[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / VehicleJobSteerPushResult

# Interface: VehicleJobSteerPushResult

Defined in: [packages/vehicle-core/src/vehicle-jobs.ts:140](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-jobs.ts#L140)

A job's mid-flight input channel -- the "steer" primitive. Bounded FIFO:
push() while a handler isn't yet reading buffers up to maxQueueSize, then
refuses further input rather than growing unboundedly or silently
overwriting an unread entry. A handler consumes it via `for await (const
input of context.steerInputs)`, which ends cleanly once close() is
called (VehicleJobStore does this at job finalization).

## Properties

### accepted

> `readonly` **accepted**: `boolean`

Defined in: [packages/vehicle-core/src/vehicle-jobs.ts:141](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-jobs.ts#L141)

***

### dropReason?

> `readonly` `optional` **dropReason?**: `"queue-full"` \| `"channel-closed"`

Defined in: [packages/vehicle-core/src/vehicle-jobs.ts:142](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-jobs.ts#L142)
