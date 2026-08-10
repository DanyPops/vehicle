[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / VehicleErrorPredicateMapping

# Interface: VehicleErrorPredicateMapping

Defined in: [packages/vehicle-core/src/vehicle-errors.ts:74](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-errors.ts#L74)

## Properties

### category

> `readonly` **category**: [`VehicleFailureCategory`](../type-aliases/VehicleFailureCategory.md)

Defined in: [packages/vehicle-core/src/vehicle-errors.ts:76](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-errors.ts#L76)

***

### code?

> `readonly` `optional` **code?**: `string`

Defined in: [packages/vehicle-core/src/vehicle-errors.ts:77](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-errors.ts#L77)

***

### matches

> `readonly` **matches**: (`error`) => `boolean`

Defined in: [packages/vehicle-core/src/vehicle-errors.ts:75](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-errors.ts#L75)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`
