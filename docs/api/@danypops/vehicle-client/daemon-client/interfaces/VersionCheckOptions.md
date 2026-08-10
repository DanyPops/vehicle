[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client](../../README.md) / [daemon-client](../README.md) / VersionCheckOptions

# Interface: VersionCheckOptions\<Handle, Client\>

Defined in: [packages/vehicle-client/src/daemon-client.ts:438](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L438)

## Type Parameters

### Handle

`Handle` *extends* [`DaemonHandleLike`](DaemonHandleLike.md)

### Client

`Client`

## Properties

### connectRetry?

> `optional` **connectRetry?**: [`ConnectVersionCheckRetryOptions`](ConnectVersionCheckRetryOptions.md)

Defined in: [packages/vehicle-client/src/daemon-client.ts:466](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L466)

Bounded retry/backoff around the initial connect+readVersion round trip -- closes a real
TOCTOU race: two concurrent callers can both connect to the same stale daemon, but only
one needs to actually kill it -- every other in-flight caller's own readVersion() then
hits a connection freshly closed out from under it and would otherwise throw, even though
the daemon is being correctly replaced. Retrying re-reads the handle fresh each attempt,
so it picks up whatever the current real state is (often an already-live replacement)
instead of propagating a transient failure that was never a real problem. Modeled on
connectPushChannel's own reconnect backoff. Sized larger than vehicle-client-pi's
registerVehicleTools handshake retry (which closes the analogous race one layer up, but
only needs to survive a daemon's ~100-300ms cold boot): this retry must survive a whole
concurrent kill-wait-respawn cycle, which shutdownTimeoutMs alone allows up to 2000ms for.
Defaults to attempts:8, initialDelayMs:100, maxDelayMs:1000, growFactor:1.8 (~5.2s worst
case). Set attempts:1 to restore the old immediate-failure behavior exactly.

***

### expectedVersion

> **expectedVersion**: [`ExpectedVersion`](../type-aliases/ExpectedVersion.md)

Defined in: [packages/vehicle-client/src/daemon-client.ts:440](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L440)

This extension's own expected daemon version/protocol identifier. Resolved fresh on every call -- see ExpectedVersion.

***

### killStaleProcess

> **killStaleProcess**: (`handle`) => `void`

Defined in: [packages/vehicle-client/src/daemon-client.ts:446](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L446)

Hard fallback: signal the stale daemon's process directly (e.g. `process.kill(handle.pid, "SIGTERM")`). Must not throw for an already-dead pid.

#### Parameters

##### handle

`Handle`

#### Returns

`void`

***

### readVersion

> **readVersion**: (`client`) => `Promise`\<`string`\>

Defined in: [packages/vehicle-client/src/daemon-client.ts:442](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L442)

Reads the connected daemon's reported version (e.g. via its /health response). A connection failure here is retried -- see connectRetry -- rather than propagated as-is; every other error still propagates unchanged, and an inconclusive read never triggers a kill.

#### Parameters

##### client

`Client`

#### Returns

`Promise`\<`string`\>

***

### requestShutdown?

> `optional` **requestShutdown?**: (`client`) => `Promise`\<`void`\>

Defined in: [packages/vehicle-client/src/daemon-client.ts:444](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L444)

Best-effort graceful shutdown request against the stale daemon. Its failure is swallowed -- killStaleProcess is the real fallback that must always work.

#### Parameters

##### client

`Client`

#### Returns

`Promise`\<`void`\>

***

### shutdownPollIntervalMs?

> `optional` **shutdownPollIntervalMs?**: `number`

Defined in: [packages/vehicle-client/src/daemon-client.ts:450](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L450)

Poll interval while waiting for the handle file to clear. Defaults to 50ms.

***

### shutdownTimeoutMs?

> `optional` **shutdownTimeoutMs?**: `number`

Defined in: [packages/vehicle-client/src/daemon-client.ts:448](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L448)

Bounded wait for the stale daemon's handle file to clear after shutdown/kill, before spawning its replacement. Defaults to 2000ms.
