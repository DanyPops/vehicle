[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [vault](../README.md) / TokenProviderOptions

# Interface: TokenProviderOptions\<T\>

Defined in: [packages/vehicle-server/src/vault.ts:122](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vault.ts#L122)

## Type Parameters

### T

`T` *extends* [`RefreshableAccessToken`](RefreshableAccessToken.md)

## Properties

### refresh?

> `optional` **refresh?**: (`current`) => `Promise`\<`T`\>

Defined in: [packages/vehicle-server/src/vault.ts:125](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vault.ts#L125)

Omit for backends whose tokens never expire.

#### Parameters

##### current

`T`

#### Returns

`Promise`\<`T`\>

***

### refreshSkewMs?

> `optional` **refreshSkewMs?**: `number`

Defined in: [packages/vehicle-server/src/vault.ts:128](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vault.ts#L128)

***

### staticFallback?

> `optional` **staticFallback?**: () => `string` \| `undefined`

Defined in: [packages/vehicle-server/src/vault.ts:127](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vault.ts#L127)

Consulted whenever there is no usable stored or refreshed credential.

#### Returns

`string` \| `undefined`

***

### store

> **store**: [`TokenProviderStore`](TokenProviderStore.md)\<`T`\>

Defined in: [packages/vehicle-server/src/vault.ts:123](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vault.ts#L123)
