[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [daemon](../README.md) / runDaemonProcess

# Function: runDaemonProcess()

> **runDaemonProcess**(`options`): `void`

Defined in: [packages/vehicle-server/src/daemon.ts:442](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon.ts#L442)

The real binary's entry point: starts the daemon, wires SIGINT/SIGTERM to
a clean stop + exit. A DaemonAlreadyRunningError (another live process
already holds the single-instance lock) is a normal join, not a crash --
this process exits 0 without ever having bound a port.

## Parameters

### options

[`RunDaemonProcessOptions`](../interfaces/RunDaemonProcessOptions.md)

## Returns

`void`
