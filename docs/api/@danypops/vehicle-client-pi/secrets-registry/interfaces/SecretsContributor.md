[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [secrets-registry](../README.md) / SecretsContributor

# Interface: SecretsContributor

Defined in: [packages/vehicle-client-pi/src/secrets-registry.ts:41](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-registry.ts#L41)

## Properties

### resolve

> **resolve**: () => [`SecretsContribution`](SecretsContribution.md) \| `Promise`\<[`SecretsContribution`](SecretsContribution.md)\>

Defined in: [packages/vehicle-client-pi/src/secrets-registry.ts:45](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-registry.ts#L45)

Called fresh on every /secrets invocation, so a contributor can rebuild its backends against current daemon/config state instead of a stale extension-load-time snapshot.

#### Returns

[`SecretsContribution`](SecretsContribution.md) \| `Promise`\<[`SecretsContribution`](SecretsContribution.md)\>

***

### source

> **source**: `string`

Defined in: [packages/vehicle-client-pi/src/secrets-registry.ts:43](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-registry.ts#L43)

Stable per-consumer key, e.g. "enigma", "pipes", "tickets" -- registering again under the same key replaces the prior contributor instead of duplicating it, so a hot-reloaded extension doesn't accumulate stale copies of itself.
