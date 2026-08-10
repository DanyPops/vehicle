[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [vault](../README.md) / createTokenProvider

# Function: createTokenProvider()

> **createTokenProvider**\<`T`\>(`options`): () => `Promise`\<`string` \| `undefined`\>

Defined in: [packages/vehicle-server/src/vault.ts:142](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vault.ts#L142)

Builds a `getToken()` an adapter calls before every request instead of
holding a static token string. Concurrent callers during a refresh share
one in-flight promise rather than each starting their own: several
providers issue rotating, single-use refresh tokens, so two independent
refresh calls racing on the same stale refresh token would have the loser
fail outright. JS's run-to-completion semantics make a plain closure
variable sufficient here — everything from reading the store to assigning
the in-flight promise happens synchronously, so a second caller can only
ever observe the flag after the first caller has set it.

## Type Parameters

### T

`T` *extends* [`RefreshableAccessToken`](../interfaces/RefreshableAccessToken.md)

## Parameters

### options

[`TokenProviderOptions`](../interfaces/TokenProviderOptions.md)\<`T`\>

## Returns

() => `Promise`\<`string` \| `undefined`\>
