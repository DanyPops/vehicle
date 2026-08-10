[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-watched-refresh](../README.md) / startWatchedRefresh

# Function: startWatchedRefresh()

> **startWatchedRefresh**(`options`): [`WatchedRefreshHandle`](../interfaces/WatchedRefreshHandle.md)

Defined in: [packages/vehicle-client-pi/src/vehicle-watched-refresh.ts:129](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-watched-refresh.ts#L129)

Starts polling immediately (does not wait for the first tick) and
attempts to establish the push connection in the background -- a widget
gets an immediate refresh without waiting on a network round trip first.

## Parameters

### options

[`WatchedRefreshOptions`](../interfaces/WatchedRefreshOptions.md)

## Returns

[`WatchedRefreshHandle`](../interfaces/WatchedRefreshHandle.md)
