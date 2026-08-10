[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-pi](../README.md) / registerVehicleTools

# Function: registerVehicleTools()

> **registerVehicleTools**(`pi`, `client`, `options?`): `Promise`\<[`RegisteredPiVehicle`](../interfaces/RegisteredPiVehicle.md)\>

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:1004](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L1004)

Projects a `VehicleClient`'s manifest into native Pi tools,
preserving exact operation versions, schemas, cancellation, Pi
call/session identity, explicit permissions and principals, keyed
idempotency, progress, and structured failures.

A currently-unavailable operation (per the manifest's `available` flag),
or one whose declared `permissions` aren't fully covered by this
registration's own `options.permissions` (the exact superset check
`VehicleRegistry.invoke()` already enforces at call time, applied here to
visibility instead), is still registered as a Pi tool -- Pi has no
`unregisterTool()` -- but curated out of the LLM's active/callable set
from this very first call, via the Vehicle-agnostic `syncManagedActiveTools`
primitive. A caller never sees a tool it has no permissions to call in
the first place.

Registers definitions immediately; only active-tool synchronization is
deferred to `session_start`, since Pi action methods aren't available
during extension loading.

## Parameters

### pi

`ExtensionAPI`

### client

`VehicleClient`

### options?

[`RegisterVehicleToolsOptions`](../interfaces/RegisterVehicleToolsOptions.md) = `{}`

## Returns

`Promise`\<[`RegisteredPiVehicle`](../interfaces/RegisteredPiVehicle.md)\>

## Example

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerVehicleTools } from "@danypops/vehicle-client-pi";

export default async function (pi: ExtensionAPI) {
  await registerVehicleTools(pi, client, {
    permissions: ["issues:read"],
    principal: { id: "pi-extension" },
    closeClientOnSessionShutdown: true,
  });
}
```
