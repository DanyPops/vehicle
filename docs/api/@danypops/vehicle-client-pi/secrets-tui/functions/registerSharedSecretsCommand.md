[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [secrets-tui](../README.md) / registerSharedSecretsCommand

# Function: registerSharedSecretsCommand()

> **registerSharedSecretsCommand**(`pi`, `contributor`, `commandName?`): `void`

Defined in: [packages/vehicle-client-pi/src/secrets-tui.ts:455](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-tui.ts#L455)

Registers this consumer as a contributor to the shared `/secrets`
namespace (default commandName) instead of a standalone command of its
own. Every consumer calling this -- Enigma, pipes, tickets, whichever
order they load in -- lands in the same `/secrets` command: exactly one
of them (whichever gets here first) actually calls pi.registerCommand,
per claimSecretsCommandName's contract; every other one still shows up
because the command handler re-reads every registered contributor fresh
on each invocation, not just the claiming one's own.

Use registerSecretsCommand instead when a consumer genuinely wants its
own standalone command, unrelated to any other consumer's secrets (rare
-- most consumers sharing a Pi session want the same
`/secrets` surface).

## Parameters

### pi

`ExtensionAPI`

### contributor

[`SecretsContributor`](../../secrets-registry/interfaces/SecretsContributor.md)

### commandName?

`string` = `"secrets"`

## Returns

`void`
