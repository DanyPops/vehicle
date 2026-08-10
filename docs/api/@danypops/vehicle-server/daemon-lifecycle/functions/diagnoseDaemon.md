[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [daemon-lifecycle](../README.md) / diagnoseDaemon

# Function: diagnoseDaemon()

> **diagnoseDaemon**(`options`): `Promise`\<[`DaemonDiagnosis`](../interfaces/DaemonDiagnosis.md)\>

Defined in: [packages/vehicle-server/src/daemon-lifecycle.ts:134](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon-lifecycle.ts#L134)

Assembles "who am I, and what happened recently" -- the one function a Vehicle-backed
daemon's own composition root wires into a `daemon.diagnose` operation (a few lines, not a
bespoke per-daemon implementation), so a caller never reads daemon-owned SQLite/state files
directly to answer "is this daemon flapping".

## Parameters

### options

[`DiagnoseDaemonOptions`](../interfaces/DiagnoseDaemonOptions.md)

## Returns

`Promise`\<[`DaemonDiagnosis`](../interfaces/DaemonDiagnosis.md)\>
