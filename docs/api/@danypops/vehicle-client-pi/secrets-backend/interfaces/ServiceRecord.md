[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [secrets-backend](../README.md) / ServiceRecord

# Interface: ServiceRecord

Defined in: [packages/vehicle-client-pi/src/secrets-backend.ts:56](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-backend.ts#L56)

The [services] side: a consumer daemon (pipes, tickets, enigma itself, ...)
and which secret names it may use. Deliberately the same shape as Enigma's
own ClientRegistration (minus tokenHash) -- not a new format, just exposed
generically so any ServicesRegistry-shaped data source (Enigma's real
client-registry.ts, or a future non-Enigma one) can be passed in unchanged.

## Properties

### backends

> **backends**: `string`[]

Defined in: [packages/vehicle-client-pi/src/secrets-backend.ts:58](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-backend.ts#L58)

***

### name

> **name**: `string`

Defined in: [packages/vehicle-client-pi/src/secrets-backend.ts:57](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-backend.ts#L57)

***

### uid?

> `optional` **uid?**: `number`

Defined in: [packages/vehicle-client-pi/src/secrets-backend.ts:60](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-backend.ts#L60)

Kernel-verified caller uid (SO_PEERCRED), when the registry binds one.
