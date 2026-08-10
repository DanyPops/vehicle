[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-pi](../README.md) / boundVehicleModelContent

# Function: boundVehicleModelContent()

> **boundVehicleModelContent**(`content`, `maxBytes?`): readonly `VehicleContentBlock`[]

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:444](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L444)

Applies the Pi transcript budget to semantic blocks and JSON fallback alike, stripping terminal-only ANSI first.

## Parameters

### content

readonly `VehicleContentBlock`[]

### maxBytes?

`number` = `DEFAULT_MODEL_CONTENT_MAX_BYTES`

## Returns

readonly `VehicleContentBlock`[]
