[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / VehicleEventDescriptor

# Interface: VehicleEventDescriptor

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:307](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L307)

A named, schema'd event type a provider declares as part of its
manifest -- the typed alternative to a raw PushChannel.publish(topic,
payload) call with a hand-invented topic string. Confirmed independently
reinvented three-plus times across Papyrus and Lector before this
existed (see this task's own body). No `available` flag the way an
operation has one: an event type, once declared, is always emittable --
there's no credential-gated "this event is currently unavailable"
concept the way a live external-service-backed operation can have.

## Properties

### description

> `readonly` **description**: `string`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:310](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L310)

***

### maxPayloadBytes

> `readonly` **maxPayloadBytes**: `number`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:313](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L313)

Same bounded-resource discipline as an operation's own maxRequestBytes/maxResponseBytes -- required, never silently defaulted.

***

### name

> `readonly` **name**: `string`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:308](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L308)

***

### payloadSchema

> `readonly` **payloadSchema**: [`JsonSchema`](../type-aliases/JsonSchema.md)

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:311](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L311)

***

### version

> `readonly` **version**: `number`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:309](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L309)
