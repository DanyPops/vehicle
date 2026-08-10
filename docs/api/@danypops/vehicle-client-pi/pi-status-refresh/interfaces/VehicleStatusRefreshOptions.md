[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [pi-status-refresh](../README.md) / VehicleStatusRefreshOptions

# Interface: VehicleStatusRefreshOptions

Defined in: [packages/vehicle-client-pi/src/pi-status-refresh.ts:18](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/pi-status-refresh.ts#L18)

## Properties

### ownToolPrefixes

> `readonly` **ownToolPrefixes**: readonly `string`[]

Defined in: [packages/vehicle-client-pi/src/pi-status-refresh.ts:20](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/pi-status-refresh.ts#L20)

A tool name starting with any of these is "one of mine" -- refresh again after it runs.

***

### refresh

> `readonly` **refresh**: (`ctx`) => `void` \| `Promise`\<`void`\>

Defined in: [packages/vehicle-client-pi/src/pi-status-refresh.ts:22](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/pi-status-refresh.ts#L22)

Does the real refresh (e.g. re-fetch focus state and call ctx.ui.setStatus). Thrown/rejected errors are swallowed.

#### Parameters

##### ctx

`ExtensionContext`

#### Returns

`void` \| `Promise`\<`void`\>
