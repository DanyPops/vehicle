[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / VehicleContentBlock

# Interface: VehicleContentBlock

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:121](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L121)

A block of narrative text meant to be read by the model, not parsed as
data -- same field name and shape MCP's own CallToolResult.content and
Pi's own ToolDefinition.execute() return already use, so a Vehicle
operation adopting this needs no translation layer at either boundary.
Only the "text" variant exists here; there's no Vehicle use case yet for
MCP's image/audio/resource-link block kinds.

## Properties

### text

> `readonly` **text**: `string`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:123](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L123)

***

### type

> `readonly` **type**: `"text"`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:122](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L122)
