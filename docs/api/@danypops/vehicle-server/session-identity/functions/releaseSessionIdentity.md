[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [session-identity](../README.md) / releaseSessionIdentity

# Function: releaseSessionIdentity()

> **releaseSessionIdentity**(`store`, `sessionId`, `secret`): `void`

Defined in: [packages/vehicle-server/src/session-identity.ts:117](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/session-identity.ts#L117)

Releases a session id's identity, requiring the correct secret. Idempotent: a wrong or
missing secret, or an already-absent session id, safely does nothing rather than erroring
-- this also avoids an oracle for "does this session id exist" to a caller who doesn't
already hold its secret.

## Parameters

### store

[`SessionIdentityStore`](../interfaces/SessionIdentityStore.md)

### sessionId

`string`

### secret

`string` \| `undefined`

## Returns

`void`
