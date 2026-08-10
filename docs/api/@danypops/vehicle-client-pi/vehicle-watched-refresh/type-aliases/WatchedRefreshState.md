[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-watched-refresh](../README.md) / WatchedRefreshState

# Type Alias: WatchedRefreshState

> **WatchedRefreshState** = `"connecting"` \| `"connected"` \| `"polling"` \| `"renewing"` \| `"resolver-failed"` \| `"timed-out"` \| `"canceled"`

Defined in: [packages/vehicle-client-pi/src/vehicle-watched-refresh.ts:52](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-watched-refresh.ts#L52)

"connecting"/"connected"/"polling" are ordinary, expected states a live widget cycles
through; "renewing" is also ordinary (a daemon restart or a reported-unknown watch is a
routine event, not a failure). "resolver-failed", "timed-out", and "canceled" are the three
terminal-for-push shapes a presentation must be able to distinguish so it never shows a
"refreshing" spinner indefinitely -- polling (if the push target still resolves at all)
keeps the widget's data fresh regardless of which state push itself is in.
