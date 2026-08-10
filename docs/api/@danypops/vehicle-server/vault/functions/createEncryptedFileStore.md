[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [vault](../README.md) / createEncryptedFileStore

# Function: createEncryptedFileStore()

> **createEncryptedFileStore**\<`T`\>(`options`, `backend`): [`TokenProviderStore`](../interfaces/TokenProviderStore.md)\<`T`\>

Defined in: [packages/vehicle-server/src/vault.ts:83](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vault.ts#L83)

AES-256-GCM at rest, one file per backend. GCM's authentication tag makes
"wrong master key" and "tampered file" the same failure mode — decryption
throws rather than silently returning garbage, so a caller never mistakes
a corrupted or mis-keyed file for a valid (if wrong) credential.

## Type Parameters

### T

`T` *extends* [`RefreshableAccessToken`](../interfaces/RefreshableAccessToken.md)

## Parameters

### options

#### dir

`string`

#### masterKey

`Buffer`

### backend

`string`

## Returns

[`TokenProviderStore`](../interfaces/TokenProviderStore.md)\<`T`\>
