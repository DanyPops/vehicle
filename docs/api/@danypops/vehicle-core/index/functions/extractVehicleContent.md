[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / extractVehicleContent

# Function: extractVehicleContent()

> **extractVehicleContent**(`output`): readonly [`VehicleContentBlock`](../interfaces/VehicleContentBlock.md)[] \| `undefined`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:146](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L146)

Reads an operation's own `content` blocks off its output when present and
well-formed, so a generic Vehicle client can prefer them over dumping raw
JSON at the model -- without knowing anything about the operation's own
domain shape. Returns undefined for a malformed or absent `content` field;
the caller falls back to its own default (formatted JSON) rather than
risk forwarding partial/garbled blocks.

## Parameters

### output

`unknown`

## Returns

readonly [`VehicleContentBlock`](../interfaces/VehicleContentBlock.md)[] \| `undefined`
