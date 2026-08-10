[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-pi](../README.md) / VehicleReadyEvent

# Type Alias: VehicleReadyEvent

> **VehicleReadyEvent** = \{ `attempt`: `number`; `attempts`: `number`; `ctx`: `ExtensionContext`; `kind`: `"client-unavailable"`; \} \| \{ `attempt`: `number`; `attempts`: `number`; `ctx`: `ExtensionContext`; `error`: `unknown`; `kind`: `"client-resolution-failed"`; \} \| \{ `attempt`: `number`; `attempts`: `number`; `ctx`: `ExtensionContext`; `error`: `unknown`; `kind`: `"registration-failed"`; \} \| \{ `attempt`: `number`; `ctx`: `ExtensionContext`; `kind`: `"registered"`; \} \| \{ `attempts`: `number`; `ctx`: `ExtensionContext`; `kind`: `"exhausted"`; \}

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:1143](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L1143)

One attempt's outcome, reported through `log` instead of the silent
return/bare-catch every consumer independently reimplemented (pi-tickets'
registerTicketsVehicle, pi-papyrus's registerNotesVehicle): `resolveClient`
returning undefined (no daemon target resolvable yet), `resolveClient`
throwing, or `registerVehicleTools` itself throwing all previously
vanished with zero diagnostic trail. `attempt`/`attempts` are 1-based and
inclusive, e.g. "2 of 5".
