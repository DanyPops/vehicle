[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client](../../README.md) / [daemon-client](../README.md) / isLikelyStaleConnectionError

# Function: isLikelyStaleConnectionError()

> **isLikelyStaleConnectionError**(`error`): `boolean`

Defined in: [packages/vehicle-client/src/daemon-client.ts:113](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L113)

True when `error` means the connection itself is bad (worth dropping the
cached client and retrying once against a fresh one) -- a dead port after
a daemon restart, a refused/reset socket, a DNS failure, a timed-out
request. False for a genuine domain-level rejection (e.g. a validation
error the daemon itself returned), which a retry cannot fix and would
only mask. Matches the heuristic already proven identical across every
consumer this module replaces.

## Parameters

### error

`unknown`

## Returns

`boolean`
