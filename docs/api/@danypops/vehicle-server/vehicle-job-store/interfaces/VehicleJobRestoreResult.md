[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [vehicle-job-store](../README.md) / VehicleJobRestoreResult

# Interface: VehicleJobRestoreResult

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:74](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L74)

## Properties

### orphanedCount

> `readonly` **orphanedCount**: `number`

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:77](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L77)

Restored records that were "running" when the process died and so could never be resumed -- resolved to status "failed", terminationReason "orphaned".

***

### restoredCount

> `readonly` **restoredCount**: `number`

Defined in: [packages/vehicle-server/src/vehicle-job-store.ts:75](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-job-store.ts#L75)
