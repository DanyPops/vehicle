[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [service](../README.md) / windowsRunCommand

# Function: windowsRunCommand()

> **windowsRunCommand**(`spec`): `string`

Defined in: [packages/vehicle-server/src/service.ts:163](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/service.ts#L163)

The exact command line stored in the Windows Run registry value.

Known gap: a Run key value is a plain command line with no mechanism to
set environment variables for the process it launches, unlike systemd's
`Environment=` or launchd's `EnvironmentVariables` dict -- so a
Windows-service-installed daemon does not receive
DAEMON_KIT_LAUNCH_PROVENANCE="service" the way Linux/macOS ones do. It
reports "unknown" instead, which resolveIdleBudgetMs() (daemon.ts)
already treats the same as "auto-spawn": a bounded idle-shutdown budget
rather than always-on. In practice this is not a correctness gap --
connectWithPolicy's auto-spawn resurrects the daemon on the next tool
call regardless of platform -- just a real, documented asymmetry: a
Windows service-installed daemon self-terminates and restarts on demand
rather than staying warm indefinitely the way Linux/macOS ones do.

## Parameters

### spec

[`ServiceSpec`](../interfaces/ServiceSpec.md)

## Returns

`string`
