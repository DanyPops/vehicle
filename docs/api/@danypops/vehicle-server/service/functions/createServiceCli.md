[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [service](../README.md) / createServiceCli

# Function: createServiceCli()

> **createServiceCli**(`spec`, `deps?`): [`ServiceCli`](../interfaces/ServiceCli.md)

Defined in: [packages/vehicle-server/src/service.ts:314](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/service.ts#L314)

Every Vehicle-backed daemon's own CLI (web-spider, papyrus, jittor, pipes,
lector, tickets, ...) otherwise hand-rolls its own install()/systemctl()
wrapper and re-derives the Armada unit name itself -- this is the one
place that logic lives, so a `service install/start/stop/restart/status`
command becomes a thin wrapper around one createServiceCli(spec) call.

## Parameters

### spec

[`ServiceSpec`](../interfaces/ServiceSpec.md)

### deps?

[`ServiceCliDeps`](../interfaces/ServiceCliDeps.md) = `...`

## Returns

[`ServiceCli`](../interfaces/ServiceCli.md)
