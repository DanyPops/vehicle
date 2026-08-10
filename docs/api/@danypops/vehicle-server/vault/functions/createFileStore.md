[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [vault](../README.md) / createFileStore

# Function: createFileStore()

> **createFileStore**\<`T`\>(`dir`, `backend`): [`TokenProviderStore`](../interfaces/TokenProviderStore.md)\<`T`\>

Defined in: [packages/vehicle-server/src/vault.ts:49](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vault.ts#L49)

Plaintext JSON, one file per backend. Documented as development-only — a real vault daemon must use createEncryptedFileStore.

## Type Parameters

### T

`T` *extends* [`RefreshableAccessToken`](../interfaces/RefreshableAccessToken.md)

## Parameters

### dir

`string`

### backend

`string`

## Returns

[`TokenProviderStore`](../interfaces/TokenProviderStore.md)\<`T`\>
