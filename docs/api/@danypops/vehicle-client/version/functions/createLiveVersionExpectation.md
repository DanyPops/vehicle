[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client](../../README.md) / [version](../README.md) / createLiveVersionExpectation

# Function: createLiveVersionExpectation()

> **createLiveVersionExpectation**(`packageJsonUrl`, `projectLabel`): () => `string`

Defined in: [packages/vehicle-server/src/version.ts:41](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/version.ts#L41)

A connectWithVersionCheck-ready ExpectedVersion supplier (see @danypops/vehicle-client's
daemon-client.ts) that re-reads packageJsonUrl fresh on every call, never caching. Fixes the
exact bug a module-level `const VERSION = readPackageVersion(...)` produces: a long-lived
process's cached version goes stale the instant `npm update` rewrites package.json
underneath it, so every later connect sees a permanent, never-self-healing false mismatch --
confirmed live in @danypops/papyrus (repeated daemon kill/respawn churn on every call from a
process that started before an update, never converging since a respawned daemon runs the
same source and reports the same real version).

## Parameters

### packageJsonUrl

`URL`

### projectLabel

`string`

## Returns

() => `string`
