[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-pi](../README.md) / registerVehicleToolsWhenReady

# Function: registerVehicleToolsWhenReady()

> **registerVehicleToolsWhenReady**(`pi`, `resolveClient`, `options?`): `Promise`\<[`RegisteredPiVehicle`](../interfaces/RegisteredPiVehicle.md) \| `undefined`\>

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:1217](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L1217)

Wraps `registerVehicleTools` with the one step it never owned: resolving
the daemon target and building a client in the first place. That step is
inherently consumer-specific (each daemon has its own handle file/target
resolution), which is why it was never centralized here before -- but the
failure handling around it (silent return on no target, bare catch on any
error, no later retry) was reimplemented identically by every consumer
and always dropped the failure on the floor. This centralizes that
handling once: every step logs through `log` instead of vanishing, and a
daemon that is merely slow to start gets bounded retries (see
VehicleReadyRetryOptions) instead of a permanent zero-tools outcome for
the rest of the session.

Registers one `session_start` handler that kicks off the resolve+register
sequence in the background (never blocks session_start itself on a
multi-attempt backoff) and returns a promise that settles once the
sequence either succeeds or exhausts its attempts -- awaiting it is
optional, useful mainly for tests and for a caller that wants to know the
final outcome (e.g. to show one status line) without polling.

Every other `RegisterVehicleToolsOptions` field (including the opt-in
`shell` activation mode) passes straight through to the eventual
`registerVehicleTools` call unchanged.

## Parameters

### pi

`ExtensionAPI`

### resolveClient

() => `Promise`\<`VehicleClient` \| `undefined`\>

### options?

[`RegisterVehicleToolsWhenReadyOptions`](../interfaces/RegisterVehicleToolsWhenReadyOptions.md) = `{}`

## Returns

`Promise`\<[`RegisteredPiVehicle`](../interfaces/RegisteredPiVehicle.md) \| `undefined`\>
