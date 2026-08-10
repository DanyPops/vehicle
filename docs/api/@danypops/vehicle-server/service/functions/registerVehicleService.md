[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [service](../README.md) / registerVehicleService

# Function: registerVehicleService()

> **registerVehicleService**(`spec`, `registrar`): `Promise`\<[`ServiceInstallResult`](../type-aliases/ServiceInstallResult.md)\>

Defined in: [packages/vehicle-server/src/service.ts:215](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/service.ts#L215)

In-process counterpart to installUserService() -- calls Armada's own
VehicleRegistrar library directly (see @danypops/armada's registrar.ts)
instead of shelling out to its CLI as a subprocess. Same validation and
Vehicle-spec projection as the CLI-backed path below; async because
Armada's manifest I/O and native reconciliation are. Introduced for
Packed's own daemon-service registration (async end-to-end already, from
its HTTP handlers down) without changing the synchronous CLI-subprocess
contract every other Vehicle-backed daemon's own `service install`
command (web-spider, papyrus, jittor, pipes, lector) already depends on.

## Parameters

### spec

[`ServiceSpec`](../interfaces/ServiceSpec.md)

### registrar

[`VehicleRegistrar`](../../../armada/index/interfaces/VehicleRegistrar.md)

## Returns

`Promise`\<[`ServiceInstallResult`](../type-aliases/ServiceInstallResult.md)\>
