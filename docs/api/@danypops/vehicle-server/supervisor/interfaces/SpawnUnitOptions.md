[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [supervisor](../README.md) / SpawnUnitOptions

# Interface: SpawnUnitOptions

Defined in: [packages/vehicle-server/src/supervisor.ts:44](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/supervisor.ts#L44)

## Properties

### platform?

> `optional` **platform?**: `Platform`

Defined in: [packages/vehicle-server/src/supervisor.ts:46](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/supervisor.ts#L46)

Defaults to process.platform. Injectable so a test can exercise the Windows fallback path from any host OS.
