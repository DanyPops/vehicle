[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client](../../README.md) / [daemon-client](../README.md) / connectWithVersionCheck

# Function: connectWithVersionCheck()

> **connectWithVersionCheck**\<`Handle`, `Client`\>(`policy`, `versionCheck`): `Promise`\<`Client`\>

Defined in: [packages/vehicle-client/src/daemon-client.ts:562](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L562)

Wraps connectWithPolicy with a one-time version handshake: an
auto-spawned daemon can outlive the extension package that spawned it --
`pi update` upgrades the npm package on disk, but a daemon process
started yesterday keeps running with yesterday's code until something
notices. Left alone, the client silently talks to a stale daemon whose
wire protocol or schema may no longer match what this session expects.

On every fresh connect (a new client instance, not a cached call), the
daemon's reported version is checked against `expectedVersion`, compared
with compareVersions (not string equality, so "which one is newer" is a
real, ordered question, not just a difference):
- Equal (or equal by comparison, e.g. "1.2" vs "1.2.0"): plain
  connectWithPolicy's path, no extra latency beyond one readVersion() call.
- Running is OLDER than expected: this is the genuine staleness case
  (`npm update` ran, the daemon didn't restart) -- replaced transparently
  (graceful shutdown request, falling back to a direct kill signal),
  reconnects against a freshly spawned one, no error surfaces.
- Running is NEWER than expected: this caller is the stale side, not the
  daemon. Two different installed copies of the same consumer package can
  coexist (a hoisted top-level copy plus another package's own undeduped
  nested copy) and each resolve a different expectedVersion from their own
  package.json -- without this direction check, they would kill and
  respawn the daemon back and forth forever, each "fixing" what the other
  had just "fixed". Refuses instead: never downgrades a live daemon, the
  caller gets an actionable error naming the version to upgrade to.

## Type Parameters

### Handle

`Handle` *extends* [`DaemonHandleLike`](../interfaces/DaemonHandleLike.md)

### Client

`Client`

## Parameters

### policy

[`ConnectPolicyOptions`](../interfaces/ConnectPolicyOptions.md)\<`Handle`, `Client`\>

### versionCheck

[`VersionCheckOptions`](../interfaces/VersionCheckOptions.md)\<`Handle`, `Client`\>

## Returns

`Promise`\<`Client`\>
