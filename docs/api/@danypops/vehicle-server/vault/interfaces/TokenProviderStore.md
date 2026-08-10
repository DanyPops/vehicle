[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [vault](../README.md) / TokenProviderStore

# Interface: TokenProviderStore\<T\>

Defined in: [packages/vehicle-server/src/vault.ts:36](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vault.ts#L36)

## Type Parameters

### T

`T` *extends* [`RefreshableAccessToken`](RefreshableAccessToken.md)

## Methods

### load()

> **load**(): `T` \| `undefined`

Defined in: [packages/vehicle-server/src/vault.ts:37](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vault.ts#L37)

#### Returns

`T` \| `undefined`

***

### save()

> **save**(`token`): `void`

Defined in: [packages/vehicle-server/src/vault.ts:38](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vault.ts#L38)

#### Parameters

##### token

`T`

#### Returns

`void`
