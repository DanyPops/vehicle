[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client](../../README.md) / [daemon-client](../README.md) / spawnDetachedDaemon

# Function: spawnDetachedDaemon()

> **spawnDetachedDaemon**(`options`): `void`

Defined in: [packages/vehicle-client/src/daemon-client.ts:655](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L655)

Centralizes the platform-correct options for auto-spawning a detached
daemon process, so each of connectWithPolicy's four independent `spawn()`
callbacks doesn't have to get this right on its own. Two Windows-specific
gaps this closes:

- `windowsHide: true` is required on win32 or a silent background
  auto-spawn pops a visible console window.
- SIGTERM is not a real signal on Windows: `child.kill("SIGTERM")` there
  terminates the process immediately rather than invoking a graceful
  shutdown handler, so a killed daemon's own cleanup (handle/lock removal)
  never runs. This function does not attempt to work around that --
  there is nothing a spawn-time option can do about a signal Windows
  doesn't implement. The single-instance lock's stale-pid recovery (see
  startDaemon) is the actual recovery path there, not graceful shutdown;
  this is stated here so no caller adds a Windows SIGTERM handler
  expecting it to reliably fire.

The caller still owns `.unref()` on whatever handle its injected `spawn`
returns -- this function only shapes the options object, since detaching
the returned child handle is inherently spawn-implementation-specific
(node:child_process vs Bun.spawn expose that differently).

## Parameters

### options

[`SpawnDetachedDaemonOptions`](../interfaces/SpawnDetachedDaemonOptions.md)

## Returns

`void`
