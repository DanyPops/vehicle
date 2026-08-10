[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / VEHICLE\_JOB\_TERMINATION\_PRECEDENCE

# Variable: VEHICLE\_JOB\_TERMINATION\_PRECEDENCE

> `const` **VEHICLE\_JOB\_TERMINATION\_PRECEDENCE**: readonly \[`"canceled"`, `"timeout"`, `"orphaned"`, `"failed"`, `"succeeded"`\]

Defined in: [packages/vehicle-core/src/vehicle-jobs.ts:6](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-jobs.ts#L6)

Highest precedence first -- an explicit cancel always wins even if the handler also settled around the same time. "orphaned" is a restart-reconciliation outcome: a job that was still "running" when its process died, so nothing ever really failed or succeeded -- the record's own status just goes stale.
