[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [vault](../README.md) / isTokenFresh

# Function: isTokenFresh()

> **isTokenFresh**(`token`, `skewMs?`): `boolean`

Defined in: [packages/vehicle-server/src/vault.ts:29](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vault.ts#L29)

A token is usable if it has no expiry, or expires more than `skewMs` from now.

## Parameters

### token

[`RefreshableAccessToken`](../interfaces/RefreshableAccessToken.md)

### skewMs?

`number` = `60_000`

## Returns

`boolean`
