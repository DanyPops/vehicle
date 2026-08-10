[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [version](../README.md) / readPackageVersion

# Function: readPackageVersion()

> **readPackageVersion**(`packageJsonUrl`, `projectLabel`): `string`

Defined in: [packages/vehicle-server/src/version.ts:19](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/version.ts#L19)

## Parameters

### packageJsonUrl

`URL`

`new URL("../package.json", import.meta.url)` from
  the caller's own version.ts, so resolution is relative to the caller's
  file, not this package's.

### projectLabel

`string`

used only in error messages, e.g. "Jittor".

## Returns

`string`
