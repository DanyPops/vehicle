[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [secrets-registry](../README.md) / claimSecretsCommandName

# Function: claimSecretsCommandName()

> **claimSecretsCommandName**(`commandName`): `boolean`

Defined in: [packages/vehicle-client-pi/src/secrets-registry.ts:82](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-registry.ts#L82)

Returns true exactly once per commandName across every vehicle-client-pi copy
in this process -- the caller that gets `true` is the one that should
actually call pi.registerCommand(commandName, ...); every other caller
must skip that call and rely on its own registerSecretsContributor
instead, since a second registerCommand for the same name would not
merge with the first (see this file's header).

## Parameters

### commandName

`string`

## Returns

`boolean`
