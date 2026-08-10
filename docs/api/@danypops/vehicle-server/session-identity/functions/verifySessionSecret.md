[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [session-identity](../README.md) / verifySessionSecret

# Function: verifySessionSecret()

> **verifySessionSecret**(`store`, `sessionId`, `secret`, `now?`): `boolean`

Defined in: [packages/vehicle-server/src/session-identity.ts:98](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/session-identity.ts#L98)

Verifies a presented secret against a registered session id, touching lastSeenAt on
success. Returns false (never throws) both when the session id was never registered and
when the secret is missing or wrong -- a caller that needs to distinguish "no armor
configured" (proceed unauthenticated, the opt-in-armor default) from "armor present but
secret wrong" (reject) must call isSessionRegistered() first.

## Parameters

### store

[`SessionIdentityStore`](../interfaces/SessionIdentityStore.md)

### sessionId

`string`

### secret

`string` \| `undefined`

### now?

() => `string`

## Returns

`boolean`
