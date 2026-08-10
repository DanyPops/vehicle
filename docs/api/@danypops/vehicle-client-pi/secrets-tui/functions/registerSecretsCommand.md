[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [secrets-tui](../README.md) / registerSecretsCommand

# Function: registerSecretsCommand()

> **registerSecretsCommand**(`pi`, `resolveOptions`, `commandName?`): `void`

Defined in: [packages/vehicle-client-pi/src/secrets-tui.ts:410](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-tui.ts#L410)

Registers the command on the given extension -- `/secrets` by default,
but Pi has no per-extension command namespacing: two extensions calling
this with the default name collide (whichever registers last silently
wins pi's own dispatch table). A consumer sharing a Pi session with
another vehicle-client-pi-based /secrets registration (e.g. pi-enigma) must
pass a distinct commandName instead. `resolveOptions` is called fresh on
every invocation, so a caller can rebuild backends against the current
daemon state instead of capturing one snapshot at extension-load time.

## Parameters

### pi

`ExtensionAPI`

### resolveOptions

() => [`RunSecretsCommandOptions`](../interfaces/RunSecretsCommandOptions.md) \| `Promise`\<[`RunSecretsCommandOptions`](../interfaces/RunSecretsCommandOptions.md)\>

### commandName?

`string` = `"secrets"`

## Returns

`void`
