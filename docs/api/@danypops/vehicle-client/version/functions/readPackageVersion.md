[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client](../../README.md) / [version](../README.md) / readPackageVersion

# Function: readPackageVersion()

> **readPackageVersion**(`packageJsonUrl`, `projectLabel`): `string`

Defined in: [packages/vehicle-server/src/version.ts:19](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/version.ts#L19)

Runtime package version read from the caller's own package.json — the
single release source of truth, never hand-duplicated or hardcoded.
Every

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

## Danypops

daemon (jittor, lector, papyrus, pipes, tickets,
web-spider-daemon) already imports this from @danypops/vehicle-server's
own version.ts rather than duplicating it; this package now does the same.
(Previously hand-duplicated here on the premise that a client-side
consumer had no other reason to need vehicle-server -- no longer true:
vehicle-local-client.ts already imports VehicleRegistry's type from
@danypops/vehicle-server, and this package already lists it as a real
dependency.)
