[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [secrets-tui](../README.md) / performReveal

# Function: performReveal()

> **performReveal**(`ctx`, `backend`, `name`): `Promise`\<`void`\>

Defined in: [packages/vehicle-client-pi/src/secrets-tui.ts:252](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-tui.ts#L252)

Refuses outside a real interactive TUI session -- `/secrets` is one
command definition shared across tui/rpc/print/json modes (see
runSecretsCommand's own defaultPick), and RPC specifically supports a
non-human caller driving the same picks a human would in TUI (pi's own
"Extension UI Protocol"). Gating on ctx.mode (not ctx.hasUI, which is
also true in RPC mode) is what actually closes that gap: a human at a
real terminal can still reveal a secret, exactly as they already could
via a backend's own CLI reveal command; a scripted/RPC driver cannot.

## Parameters

### ctx

`ExtensionCommandContext`

### backend

[`SecretsBackend`](../../secrets-backend/interfaces/SecretsBackend.md)

### name

`string`

## Returns

`Promise`\<`void`\>
