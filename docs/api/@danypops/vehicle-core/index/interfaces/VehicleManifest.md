[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / VehicleManifest

# Interface: VehicleManifest

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:378](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L378)

`events` is optional purely for backward compatibility with every
hand-authored VehicleManifest test fixture across the ecosystem that
predates this field -- a real VehicleRegistry.manifest() always
populates it (as [] when no events are declared), never omits it.

## Extends

- [`VehicleManifestIdentity`](VehicleManifestIdentity.md)

## Properties

### description

> `readonly` **description**: `string`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:279](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L279)

#### Inherited from

[`VehicleManifestIdentity`](VehicleManifestIdentity.md).[`description`](VehicleManifestIdentity.md#description)

***

### events?

> `readonly` `optional` **events?**: readonly [`VehicleEventDescriptor`](VehicleEventDescriptor.md)[]

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:380](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L380)

***

### guidance?

> `readonly` `optional` **guidance?**: readonly `string`[]

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:280](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L280)

#### Inherited from

[`VehicleManifestIdentity`](VehicleManifestIdentity.md).[`guidance`](VehicleManifestIdentity.md#guidance)

***

### name

> `readonly` **name**: `string`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:277](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L277)

#### Inherited from

[`VehicleManifestIdentity`](VehicleManifestIdentity.md).[`name`](VehicleManifestIdentity.md#name)

***

### operations

> `readonly` **operations**: readonly [`VehicleManifestOperation`](VehicleManifestOperation.md)[]

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:379](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L379)

***

### version

> `readonly` **version**: `string`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:278](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L278)

#### Inherited from

[`VehicleManifestIdentity`](VehicleManifestIdentity.md).[`version`](VehicleManifestIdentity.md#version)
