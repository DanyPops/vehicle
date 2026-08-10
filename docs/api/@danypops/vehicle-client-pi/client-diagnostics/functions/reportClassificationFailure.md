[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [client-diagnostics](../README.md) / reportClassificationFailure

# Function: reportClassificationFailure()

> **reportClassificationFailure**(`originalError`, `internalFailure`): `void`

Defined in: [packages/vehicle-client-pi/src/client-diagnostics.ts:97](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/client-diagnostics.ts#L97)

Reports that sanitizedFailure()'s own classification chain failed internally while handling
`originalError` -- e.g. an instanceof check whose right-hand side unexpectedly resolved to a
non-object at runtime (a broken/duplicated dependency resolution), or any other exception a
classifier must never let escape. Publishes to the diagnostics_channel unconditionally
(subscribing is the opt-in there) and appends to the file log only when VEHICLE_CLIENT_DIAG=1.

Never throws on its own account. A subscriber's own exception is deliberately not this
function's concern to swallow: `channel.publish()` already isolates that to
`process.on('uncaughtException')` per node:diagnostics_channel's own documented contract --
"we don't want a publisher to crash only because a subscriber is doing something wrong" -- so
duplicating that protection here would be redundant at best and would mask a genuinely broken
subscriber at worst. A subscriber that throws is a bug in that subscriber, not in this module.

## Parameters

### originalError

`unknown`

### internalFailure

`unknown`

## Returns

`void`
