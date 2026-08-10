[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client](../../README.md) / [daemon-client](../README.md) / ExpectedVersion

# Type Alias: ExpectedVersion

> **ExpectedVersion** = `string` \| (() => `string`) \| (() => `Promise`\<`string`\>)

Defined in: [packages/vehicle-client/src/daemon-client.ts:436](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L436)

A plain string is fine for a genuinely fixed/compiled version. Everything else should pass a
supplier instead: a plain string can never be "fresh" by construction, so caching one read
once at module load (the natural, obvious way to read "my own version") goes stale the
moment `npm update` rewrites package.json underneath an already-running process -- every
later connect then sees a permanent, never-self-healing false mismatch. See
createLiveVersionExpectation() (./version.ts) for the correct always-fresh supplier.
