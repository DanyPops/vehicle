[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [pi-load-harness](../README.md) / verifyLoadableUnderPi

# Function: verifyLoadableUnderPi()

> **verifyLoadableUnderPi**(`modulePath`): `Promise`\<[`PiLoadPathResult`](../interfaces/PiLoadPathResult.md)[]\>

Defined in: [packages/vehicle-client-pi/src/pi-load-harness.ts:72](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/pi-load-harness.ts#L72)

Loads `modulePath` (an absolute path to a .ts/.js module) through all
three Pi extension load paths and reports one result per path. Never
throws itself -- a failing path is a result with ok:false, so a caller can
assert on every path in one place instead of the first failure aborting
the others.

## Parameters

### modulePath

`string`

## Returns

`Promise`\<[`PiLoadPathResult`](../interfaces/PiLoadPathResult.md)[]\>
