[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [vault](../README.md) / RefreshableAccessToken

# Interface: RefreshableAccessToken

Defined in: [packages/vehicle-server/src/vault.ts:18](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vault.ts#L18)

## Properties

### accessToken

> **accessToken**: `string`

Defined in: [packages/vehicle-server/src/vault.ts:19](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vault.ts#L19)

***

### expiresAt?

> `optional` **expiresAt?**: `string`

Defined in: [packages/vehicle-server/src/vault.ts:22](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vault.ts#L22)

ISO timestamp; absent means the provider issued a non-expiring token (e.g. classic GitHub OAuth Apps).

***

### extra?

> `optional` **extra?**: `Record`\<`string`, `string`\>

Defined in: [packages/vehicle-server/src/vault.ts:25](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vault.ts#L25)

Backend-specific extras that don't fit the common shape, e.g. Jira's cloudId.

***

### refreshToken?

> `optional` **refreshToken?**: `string`

Defined in: [packages/vehicle-server/src/vault.ts:20](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vault.ts#L20)

***

### scope?

> `optional` **scope?**: `string`

Defined in: [packages/vehicle-server/src/vault.ts:23](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vault.ts#L23)
