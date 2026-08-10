[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [session-identity](../README.md) / RegisterSessionIdentityResult

# Interface: RegisterSessionIdentityResult

Defined in: [packages/vehicle-server/src/session-identity.ts:45](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/session-identity.ts#L45)

## Properties

### secret

> **secret**: `string`

Defined in: [packages/vehicle-server/src/session-identity.ts:48](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/session-identity.ts#L48)

Plaintext secret, generated fresh on every call. Shown to the caller exactly once -- only the hash is ever persisted.

***

### sessionId

> **sessionId**: `string`

Defined in: [packages/vehicle-server/src/session-identity.ts:46](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/session-identity.ts#L46)
