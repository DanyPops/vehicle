[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/armada](../../README.md) / [index](../README.md) / readManifestFile

# Function: readManifestFile()

> **readManifestFile**(`path`): `Promise`\<[`ManifestMutationOutcome`](../type-aliases/ManifestMutationOutcome.md)\>

Defined in: [fleet/manifest-store.ts:12](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/fleet/manifest-store.ts#L12)

Bootstraps an empty manifest on ENOENT (a Vehicle's first-ever registration) rather than failing closed -- distinct from the CLI's own reconcile/plan/status commands, which require an already-existing manifest file.

## Parameters

### path

`string`

## Returns

`Promise`\<[`ManifestMutationOutcome`](../type-aliases/ManifestMutationOutcome.md)\>
