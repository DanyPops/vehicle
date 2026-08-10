[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [paths](../README.md) / acquireDaemonLock

# Function: acquireDaemonLock()

> **acquireDaemonLock**(`lockPath`, `isPidAlive?`, `provenance?`): [`AcquireLockResult`](../type-aliases/AcquireLockResult.md)

Defined in: [packages/vehicle-server/src/paths.ts:258](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/paths.ts#L258)

Atomically claims the single-instance lock so at most one daemon process
ever proceeds to bind a port, regardless of how many callers race to
start one concurrently (N Pi sessions all auto-spawning at once, or a
human running `serve` twice by hand). A losing caller must not bind a
port or touch the handle file at all -- it should exit(0) as a normal
join, never as an error.

A lock naming a pid that is no longer alive (crash, -9, OOM-kill left it
behind without running the matching releaseDaemonLock) is detected via a
liveness check and atomically stolen rather than blocking forever --
self-healing without any manual cleanup.

`provenance` records who is asking (matching daemon.ts's own launch-provenance
signal) so a later failed acquisition can tell an unmanaged holder apart from a
supervised one -- see acquireDaemonLockAsService, the only current reader of
holderProvenance.

## Parameters

### lockPath

`string`

### isPidAlive?

(`pid`) => `boolean`

### provenance?

[`LockLaunchProvenance`](../type-aliases/LockLaunchProvenance.md) = `"unknown"`

## Returns

[`AcquireLockResult`](../type-aliases/AcquireLockResult.md)
