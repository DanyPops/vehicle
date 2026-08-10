[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [daemon](../README.md) / resolveIdleBudgetMs

# Function: resolveIdleBudgetMs()

> **resolveIdleBudgetMs**(`explicit`, `provenance`): `number`

Defined in: [packages/vehicle-server/src/daemon.ts:122](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon.ts#L122)

Pure resolution rule, exported for direct testing without waiting out a real idle window. Explicit always wins; "service" provenance means always-on (0/disabled); anything else gets the bounded auto-spawn default.

## Parameters

### explicit

`number` \| `undefined`

### provenance

[`LaunchProvenance`](../type-aliases/LaunchProvenance.md)

## Returns

`number`
