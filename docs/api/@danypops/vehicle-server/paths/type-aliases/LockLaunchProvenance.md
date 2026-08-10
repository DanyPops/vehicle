[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [paths](../README.md) / LockLaunchProvenance

# Type Alias: LockLaunchProvenance

> **LockLaunchProvenance** = `"auto-spawn"` \| `"service"` \| `"unknown"`

Defined in: [packages/vehicle-server/src/paths.ts:183](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/paths.ts#L183)

Independently declared from daemon.ts's own LaunchProvenance (same three literals) rather
than imported -- this file stays dependency-free by design (see the module doc comment),
and the two unions are structurally identical so a LaunchProvenance value already passes
through unchanged wherever this type is expected.
