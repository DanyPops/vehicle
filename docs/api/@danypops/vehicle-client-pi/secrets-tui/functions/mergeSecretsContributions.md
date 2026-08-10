[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [secrets-tui](../README.md) / mergeSecretsContributions

# Function: mergeSecretsContributions()

> **mergeSecretsContributions**(`contributions`): [`RunSecretsCommandOptions`](../interfaces/RunSecretsCommandOptions.md)

Defined in: [packages/vehicle-client-pi/src/secrets-tui.ts:431](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-tui.ts#L431)

Merges every contributor's freshly-resolved SecretsContribution into one
RunSecretsCommandOptions -- backends and extraActions concatenate;
ServicesRegistry.list() results concatenate across every contributor
that supplied one (Enigma's real vault clients alongside tickets' own
self-declared entry both show up in the same [services] menu). Exported
directly (not just used inside registerSharedSecretsCommand) so a test
can assert on the merge itself without touching the process-wide
registry at all.

## Parameters

### contributions

[`SecretsContribution`](../../secrets-registry/interfaces/SecretsContribution.md)[]

## Returns

[`RunSecretsCommandOptions`](../interfaces/RunSecretsCommandOptions.md)
