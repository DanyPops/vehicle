[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/armada](../../README.md) / [index](../README.md) / ArmadaManifestSchema

# Variable: ArmadaManifestSchema

> `const` **ArmadaManifestSchema**: `TObject`\<\{ `schemaVersion`: `TLiteral`\<`1`\>; `vehicles`: `TArray`\<`TObject`\<\{ `arguments`: `TOptional`\<`TArray`\<`TString`\>\>; `env`: `TOptional`\<`TRecord`\<`"^.*$"`, `TString`\>\>; `executable`: `TString`; `handlePath`: `TString`; `name`: `TString`; `readiness`: `TObject`\<\{ `pollIntervalMs`: `TInteger`; `timeoutMs`: `TInteger`; \}\>; `resources`: `TOptional`\<`TObject`\<\{ `cpuWeight`: `TOptional`\<`TObject`\<\{ `enforcement`: ...; `value`: ...; \}\>\>; `maximumCpuPercent`: `TOptional`\<`TObject`\<\{ `enforcement`: ...; `value`: ...; \}\>\>; `maximumMemoryBytes`: `TOptional`\<`TObject`\<\{ `enforcement`: ...; `value`: ...; \}\>\>; `maximumMemoryPercent`: `TOptional`\<`TObject`\<\{ `enforcement`: ...; `value`: ...; \}\>\>; `maximumTasks`: `TOptional`\<`TObject`\<\{ `enforcement`: ...; `value`: ...; \}\>\>; `memoryHighBytes`: `TOptional`\<`TObject`\<\{ `enforcement`: ...; `value`: ...; \}\>\>; `memoryHighPercent`: `TOptional`\<`TObject`\<\{ `enforcement`: ...; `value`: ...; \}\>\>; `memoryLowPercent`: `TOptional`\<`TObject`\<\{ `enforcement`: ...; `value`: ...; \}\>\>; \}\>\>; `restart`: `TUnion`\<\[`TObject`\<\{ `policy`: `TLiteral`\<`"never"`\>; \}\>, `TObject`\<\{ `delayMs`: `TInteger`; `maxAttempts`: `TInteger`; `policy`: `TUnion`\<\[..., ...\]\>; `windowMs`: `TInteger`; \}\>\]\>; `runtime`: `TOptional`\<`TObject`\<\{ `networkReadiness`: `TOptional`\<`TObject`\<\{ `enforcement`: ...; \}\>\>; `preventPrivilegeEscalation`: `TOptional`\<`TObject`\<\{ `enforcement`: ...; \}\>\>; `privateTemporaryDirectory`: `TOptional`\<`TObject`\<\{ `enforcement`: ...; \}\>\>; \}\>\>; `version`: `TString`; `workingDirectory`: `TOptional`\<`TString`\>; \}\>\>; \}\>

Defined in: [fleet/manifest.ts:96](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/fleet/manifest.ts#L96)
