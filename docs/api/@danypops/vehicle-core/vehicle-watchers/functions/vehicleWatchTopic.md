[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [vehicle-watchers](../README.md) / vehicleWatchTopic

# Function: vehicleWatchTopic()

> **vehicleWatchTopic**(`watchId`): `string`

Defined in: [packages/vehicle-core/src/vehicle-watchers.ts:118](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-watchers.ts#L118)

The wire topic name a watch's changes publish under -- one shared naming
function so a provider's publish() call and a subscriber's connectPushChannel()
topic can never drift apart, the same role vehicleEventTopic() plays for
Vehicle Events' own declared, fixed-schema event types. Deliberately a
separate function/namespace from vehicleEventTopic(): a watch's topic is
per-watch-instance-dynamic (one new topic per watchId), not a small fixed
set of declared event types, so it doesn't fit Vehicle Events' own
name@version schema-declaration model -- it reuses the same PushChannel
transport substrate Vehicle Events made available generically, not the
declared-event-type layer itself.

## Parameters

### watchId

`string`

## Returns

`string`
