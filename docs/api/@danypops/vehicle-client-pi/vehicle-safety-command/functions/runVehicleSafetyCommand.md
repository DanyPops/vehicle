[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-safety-command](../README.md) / runVehicleSafetyCommand

# Function: runVehicleSafetyCommand()

> **runVehicleSafetyCommand**(`ctx`, `options`): `Promise`\<`void`\>

Defined in: [packages/vehicle-client-pi/src/vehicle-safety-command.ts:276](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety-command.ts#L276)

The full flow: resolves every contributor, and, when ctx.hasUI/ctx.mode
allow it, opens one Tab-cycled overlay -- reopened after every edit so
the human sees the effect immediately. A non-interactive caller
(ctx.mode !== "tui") gets a plain notify() summary instead, matching
secrets-tui.ts's own fallback for the same case.

## Parameters

### ctx

`ExtensionCommandContext`

### options

[`RunVehicleSafetyCommandOptions`](../interfaces/RunVehicleSafetyCommandOptions.md)

## Returns

`Promise`\<`void`\>
