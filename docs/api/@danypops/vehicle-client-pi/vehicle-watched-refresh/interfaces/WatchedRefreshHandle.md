[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-watched-refresh](../README.md) / WatchedRefreshHandle

# Interface: WatchedRefreshHandle

Defined in: [packages/vehicle-client-pi/src/vehicle-watched-refresh.ts:93](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-watched-refresh.ts#L93)

## Methods

### reportUnknownWatch()

> **reportUnknownWatch**(): `void`

Defined in: [packages/vehicle-client-pi/src/vehicle-watched-refresh.ts:102](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-watched-refresh.ts#L102)

Signals that the current watch is no longer valid -- e.g. the daemon's own push message
or a direct RPC reported an unknown-watch condition for this topic. Forces the same
single-flighted renewal an identity change triggers, without waiting for the next poll
tick. A no-op while a renewal is already in flight (see maxRenewAttempts) or after stop().

#### Returns

`void`

***

### stop()

> **stop**(): `void`

Defined in: [packages/vehicle-client-pi/src/vehicle-watched-refresh.ts:95](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-watched-refresh.ts#L95)

Stops polling and closes any open push connection. Idempotent. Reports "canceled".

#### Returns

`void`
