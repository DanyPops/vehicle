[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-pi](../README.md) / PiVehicleToolDetails

# Interface: PiVehicleToolDetails

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:60](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L60)

## Properties

### output?

> `readonly` `optional` **output?**: `unknown`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:65](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L65)

Legacy compatibility only: historical/custom renderers may still consume raw output during the documented migration window.

***

### presentation?

> `readonly` `optional` **presentation?**: `JsonValue`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:63](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L63)

Versioned, JSON-safe human-presentation DTO persisted for new projected rows.

***

### progress?

> `readonly` `optional` **progress?**: `unknown`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:67](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L67)

Transient legacy progress compatibility; final rows do not persist this field.

***

### vehicle

> `readonly` **vehicle**: [`PiVehicleIdentity`](PiVehicleIdentity.md)

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:61](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L61)
