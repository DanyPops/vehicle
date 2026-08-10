[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [daemon](../README.md) / DEFAULT\_AUTO\_SPAWN\_IDLE\_BUDGET\_MS

# Variable: DEFAULT\_AUTO\_SPAWN\_IDLE\_BUDGET\_MS

> `const` **DEFAULT\_AUTO\_SPAWN\_IDLE\_BUDGET\_MS**: `number`

Defined in: [packages/vehicle-server/src/daemon.ts:119](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon.ts#L119)

Applied to an auto-spawned or provenance-unknown daemon when the caller doesn't set idleBudgetMs explicitly -- long enough to survive a normal idle gap between tool calls, short enough not to leak a process from one stray call for days.
