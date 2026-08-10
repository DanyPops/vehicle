[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [paths](../README.md) / acquireDaemonLockAsService

# Function: acquireDaemonLockAsService()

> **acquireDaemonLockAsService**(`lockPath`, `deps?`): `Promise`\<[`AcquireLockResult`](../type-aliases/AcquireLockResult.md)\>

Defined in: [packages/vehicle-server/src/paths.ts:340](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/paths.ts#L340)

acquireDaemonLock, plus one extra right reserved to a "service"-provenance caller (an
Armada/systemd-supervised (re)start): reclaiming the lock from an unmanaged holder that
has no standing to block it. A holder that is itself "service"-provenance is left alone
exactly like a plain acquireDaemonLock failure -- that is a genuine simultaneous-restart
race between two supervised launches, not an orphan to reap. A holder with no recorded
provenance at all (a lock file written before this field existed) is treated the same as
"unknown" -- reapable -- matching readLaunchProvenance's own fallback rule elsewhere in
this kit (an unrecognized launch is closer to auto-spawn than to a trusted service).

Never reaped blind: the holder's liveness is re-checked immediately before signaling it
(closing the gap between acquireDaemonLock's own check and this call), and the lock is
force-cleared only once the holder is confirmed dead -- never while it might still be a
live, legitimately-running process. This mirrors Armada's own fleet cleanup (fleet/cleanup.ts),
which re-derives its kill plan from live state immediately before executing it rather than
trusting an earlier snapshot.

## Parameters

### lockPath

`string`

### deps?

[`ReclaimDeps`](../interfaces/ReclaimDeps.md) = `{}`

## Returns

`Promise`\<[`AcquireLockResult`](../type-aliases/AcquireLockResult.md)\>
