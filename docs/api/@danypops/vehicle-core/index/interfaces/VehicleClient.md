[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / VehicleClient

# Interface: VehicleClient

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:383](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L383)

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:386](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L386)

#### Returns

`Promise`\<`void`\>

***

### invoke()

> **invoke**\<`Output`\>(`name`, `version`, `input`, `options?`): `Promise`\<`Output`\>

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:385](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L385)

#### Type Parameters

##### Output

`Output` = `unknown`

#### Parameters

##### name

`string`

##### version

`number`

##### input

`unknown`

##### options?

[`VehicleInvocationOptions`](VehicleInvocationOptions.md)

#### Returns

`Promise`\<`Output`\>

***

### manifest()

> **manifest**(): `Promise`\<[`VehicleManifest`](VehicleManifest.md)\>

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:384](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L384)

#### Returns

`Promise`\<[`VehicleManifest`](VehicleManifest.md)\>
