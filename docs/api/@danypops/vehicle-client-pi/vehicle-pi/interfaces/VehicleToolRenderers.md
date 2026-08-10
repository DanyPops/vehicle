[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-pi](../README.md) / VehicleToolRenderers

# Interface: VehicleToolRenderers

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:87](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L87)

## Properties

### renderCall?

> `readonly` `optional` **renderCall?**: (`args`, `theme`, `context`) => `Component`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:88](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L88)

#### Parameters

##### args

`unknown`

##### theme

`Theme`

##### context

`ToolRenderContext`\<`any`, `unknown`\>

#### Returns

`Component`

***

### renderResult?

> `readonly` `optional` **renderResult?**: (`result`, `options`, `theme`, `context`) => `Component`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:89](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L89)

#### Parameters

##### result

`AgentToolResult`\<[`PiVehicleToolDetails`](PiVehicleToolDetails.md)\>

##### options

`ToolRenderResultOptions`

##### theme

`Theme`

##### context

`ToolRenderContext`\<`any`, `unknown`\>

#### Returns

`Component`
