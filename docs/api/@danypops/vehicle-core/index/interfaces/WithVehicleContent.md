[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / WithVehicleContent

# Interface: WithVehicleContent

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:134](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L134)

An operation's Output type can intersect this to carry its own
model-facing narrative alongside its structured data, e.g.
`type RunOutput = { runId: string; created: Task[] } & WithVehicleContent`.
The operation itself builds `content` since it's the only code that
actually knows how to describe what it computed -- never a per-consumer
override bolted on wherever the operation happens to get registered.

## Properties

### content?

> `readonly` `optional` **content?**: readonly [`VehicleContentBlock`](VehicleContentBlock.md)[]

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:135](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L135)
