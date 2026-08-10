[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-pi](../README.md) / RegisteredPiVehicle

# Interface: RegisteredPiVehicle

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:287](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L287)

## Properties

### manifest

> `readonly` **manifest**: `VehicleManifest`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:288](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L288)

***

### shell?

> `readonly` `optional` **shell?**: `VehicleShellHandle`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:293](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L293)

Present only when options.shell was given -- pass this back into refreshVehicleToolAvailability so a later refresh keeps using the same TTL tracker instead of reactivating every available operation.

***

### stale

> `readonly` **stale**: `boolean`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:291](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L291)

True when `manifest` came from options.manifestCache's sidecar file rather than a live fetch -- the daemon was unreachable at registration/refresh time. A caller that cares (e.g. to show a reconnecting indicator) can check this; every existing caller ignoring it sees no behavior change.

***

### tools

> `readonly` **tools**: readonly [`RegisteredPiVehicleTool`](RegisteredPiVehicleTool.md)[]

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:289](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L289)
