[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [session-identity](../README.md) / registerSessionIdentity

# Function: registerSessionIdentity()

> **registerSessionIdentity**(`store`, `sessionId`, `now?`): [`RegisterSessionIdentityResult`](../interfaces/RegisterSessionIdentityResult.md)

Defined in: [packages/vehicle-server/src/session-identity.ts:76](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/session-identity.ts#L76)

Registers (or re-registers, rotating the secret) a session id and returns its new plaintext
secret. Rotation on every call is intentional: a host like Pi can reuse the same session id
across a "resume" of a prior process incarnation, so the newest registrant becomes the sole
legitimate holder going forward, safely invalidating any stale secret a now-exited process
held.

## Parameters

### store

[`SessionIdentityStore`](../interfaces/SessionIdentityStore.md)

### sessionId

`string`

### now?

() => `string`

## Returns

[`RegisterSessionIdentityResult`](../interfaces/RegisterSessionIdentityResult.md)
