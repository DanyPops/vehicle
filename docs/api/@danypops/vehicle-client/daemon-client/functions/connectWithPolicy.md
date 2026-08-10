[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client](../../README.md) / [daemon-client](../README.md) / connectWithPolicy

# Function: connectWithPolicy()

> **connectWithPolicy**\<`Handle`, `Client`\>(`options`): `Promise`\<`Client`\>

Defined in: [packages/vehicle-client/src/daemon-client.ts:408](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L408)

However many callers race to spawn() concurrently with no handle present
(N Pi sessions, or a human running `serve` twice by hand), only one
resulting daemon process ever binds a port and writes a handle -- that is
guaranteed daemon-side by startDaemon()'s single-instance lock (see
daemon.ts), not here. connectWithPolicy() itself needs no coordination:
every caller's poll-for-handle loop converges on whichever single daemon
actually won.

Resolves a connected client from a daemon's handle file, applying one
explicit auto-start policy instead of the silent per-daemon fork this
house's four Pi extensions each picked independently (web-spider spawns
the daemon transparently; lector/papyrus/pi-packed fail closed with an
actionable error). `autoStart` defaults to false -- opt in explicitly,
consistent with these daemons' loopback-only, nothing-happens-by-default
security posture.

## Type Parameters

### Handle

`Handle` *extends* [`DaemonHandleLike`](../interfaces/DaemonHandleLike.md)

### Client

`Client`

## Parameters

### options

[`ConnectPolicyOptions`](../interfaces/ConnectPolicyOptions.md)\<`Handle`, `Client`\>

## Returns

`Promise`\<`Client`\>
