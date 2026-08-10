[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-safety](../README.md) / VehicleSafetyPersistenceAdapter

# Interface: VehicleSafetyPersistenceAdapter

Defined in: [packages/vehicle-client-pi/src/vehicle-safety.ts:51](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety.ts#L51)

## Methods

### load()

> **load**(): `Promise`\<[`VehicleSafetyPersistedSnapshot`](VehicleSafetyPersistedSnapshot.md) \| `undefined`\>

Defined in: [packages/vehicle-client-pi/src/vehicle-safety.ts:54](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety.ts#L54)

Returns undefined if there's nothing to restore, or what's on disk doesn't look like a real snapshot -- never throws for a corrupt/foreign file.

#### Returns

`Promise`\<[`VehicleSafetyPersistedSnapshot`](VehicleSafetyPersistedSnapshot.md) \| `undefined`\>

***

### save()

> **save**(`snapshot`): `Promise`\<`void`\>

Defined in: [packages/vehicle-client-pi/src/vehicle-safety.ts:52](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety.ts#L52)

#### Parameters

##### snapshot

[`VehicleSafetyPersistedSnapshot`](VehicleSafetyPersistedSnapshot.md)

#### Returns

`Promise`\<`void`\>
