[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client](../../README.md) / [daemon-client](../README.md) / connectPushChannel

# Function: connectPushChannel()

> **connectPushChannel**(`options`): [`PushChannelClient`](../interfaces/PushChannelClient.md)

Defined in: [packages/vehicle-client/src/daemon-client.ts:812](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L812)

Subscribes to a daemon's push-invalidation channel (push-channel.ts) with
real connection resilience, not a naive reconnect-on-close:

- Exponential backoff (min/max/growFactor) gated by minUptimeMs, mirroring
  partysocket (the maintained continuation of reconnecting-websocket): a
  connection that opens then drops again immediately keeps the backoff
  climbing instead of resetting to fast retries on every brief open --
  the actual mechanism behind detecting "degraded", not just "down".
- Jitter added on top of that reference algorithm (which has none) -- the
  real shape here is several concurrent Pi sessions reconnecting to one
  Vehicle server after a restart; unjittered synchronized backoff would
  create a reconnect storm the moment the daemon comes back up.
- A heartbeat ping/timeout (mirroring ws-heartbeat) detects a socket that
  stays open while the daemon process itself is hung -- a plain
  reconnect-on-close strategy would never notice that.
- Re-subscribes every requested topic after each successful (re)connect.

Uses only the global WebSocket -- no import, keeping this module's
"no imports of its own" invariant for Pi's jiti loader (see the module
doc comment). Node 22+ and Bun both provide it as a global.

## Parameters

### options

[`PushChannelClientOptions`](../interfaces/PushChannelClientOptions.md)

## Returns

[`PushChannelClient`](../interfaces/PushChannelClient.md)
