[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client](../../README.md) / [daemon-client](../README.md) / ConnectPolicyOptions

# Interface: ConnectPolicyOptions\<Handle, Client\>

Defined in: [packages/vehicle-client/src/daemon-client.ts:363](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L363)

## Type Parameters

### Handle

`Handle` *extends* [`DaemonHandleLike`](DaemonHandleLike.md)

### Client

`Client`

## Properties

### autoStart?

> `optional` **autoStart?**: `boolean`

Defined in: [packages/vehicle-client/src/daemon-client.ts:375](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L375)

When false (default), no handle means fail closed with `fallbackMessage`
-- the security-conscious default for a loopback-only daemon: nothing
starts a new process on this caller's behalf unless explicitly asked.
When true, `spawn` is called and connectWithPolicy polls for the
handle file to appear.

***

### buildClient

> **buildClient**: (`handle`) => `Client` \| `Promise`\<`Client`\>

Defined in: [packages/vehicle-client/src/daemon-client.ts:367](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L367)

Builds a connected client from a running daemon's handle (e.g. load the auth token and construct an RPC client).

#### Parameters

##### handle

`Handle`

#### Returns

`Client` \| `Promise`\<`Client`\>

***

### fallbackMessage

> **fallbackMessage**: `string`

Defined in: [packages/vehicle-client/src/daemon-client.ts:384](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L384)

Actionable message used when no daemon is reachable and autoStart is false, or autoStart is true but the daemon never became reachable in time.

***

### pollIntervalMs?

> `optional` **pollIntervalMs?**: `number`

Defined in: [packages/vehicle-client/src/daemon-client.ts:388](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L388)

Poll interval while waiting for the handle file, in ms. Defaults to 100.

***

### readHandle

> **readHandle**: () => `Handle` \| `null`

Defined in: [packages/vehicle-client/src/daemon-client.ts:365](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L365)

Reads the daemon's current handle file; null when not running or the file is stale/unreadable.

#### Returns

`Handle` \| `null`

***

### spawn?

> `optional` **spawn?**: () => `void`

Defined in: [packages/vehicle-client/src/daemon-client.ts:382](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L382)

Starts the daemon process; required when autoStart is true. Expected to
return immediately (detached + unref'd is the caller's responsibility)
-- connectWithPolicy does its own polling, it does not await readiness
from this call.

#### Returns

`void`

***

### startTimeoutMs?

> `optional` **startTimeoutMs?**: `number`

Defined in: [packages/vehicle-client/src/daemon-client.ts:386](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L386)

Bounded wait for the handle file to appear after spawn(), in ms. Defaults to 5000.
