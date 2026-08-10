[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-safety](../README.md) / VehicleSafetyPolicyStore

# Class: VehicleSafetyPolicyStore

Defined in: [packages/vehicle-client-pi/src/vehicle-safety.ts:114](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety.ts#L114)

In-memory overrides, optionally durable via a VehicleSafetyPersistenceAdapter.
get() is always synchronous (a plain Map lookup) so registerVehicleTools/
refreshVehicleToolAvailability and the approval-gate check in vehicle-pi.ts
can consult it inline without threading async through every classification
call; set()/clear() persist (when an adapter is given) before resolving, so
a caller awaiting them knows the write actually landed.

## Methods

### clear()

> **clear**(`vehicleName`, `operationName`): `Promise`\<`void`\>

Defined in: [packages/vehicle-client-pi/src/vehicle-safety.ts:136](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety.ts#L136)

#### Parameters

##### vehicleName

`string`

##### operationName

`string`

#### Returns

`Promise`\<`void`\>

***

### get()

> **get**(`vehicleName`, `operationName`): [`VehicleSafetyState`](../type-aliases/VehicleSafetyState.md) \| `undefined`

Defined in: [packages/vehicle-client-pi/src/vehicle-safety.ts:127](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety.ts#L127)

#### Parameters

##### vehicleName

`string`

##### operationName

`string`

#### Returns

[`VehicleSafetyState`](../type-aliases/VehicleSafetyState.md) \| `undefined`

***

### list()

> **list**(): readonly [`VehicleSafetyOverrideRecord`](../interfaces/VehicleSafetyOverrideRecord.md)[]

Defined in: [packages/vehicle-client-pi/src/vehicle-safety.ts:141](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety.ts#L141)

#### Returns

readonly [`VehicleSafetyOverrideRecord`](../interfaces/VehicleSafetyOverrideRecord.md)[]

***

### set()

> **set**(`vehicleName`, `operationName`, `state`): `Promise`\<`void`\>

Defined in: [packages/vehicle-client-pi/src/vehicle-safety.ts:131](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety.ts#L131)

#### Parameters

##### vehicleName

`string`

##### operationName

`string`

##### state

[`VehicleSafetyState`](../type-aliases/VehicleSafetyState.md)

#### Returns

`Promise`\<`void`\>

***

### restore()

> `static` **restore**(`persistence?`): `Promise`\<`VehicleSafetyPolicyStore`\>

Defined in: [packages/vehicle-client-pi/src/vehicle-safety.ts:120](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety.ts#L120)

Loads any existing snapshot up front (a no-op, empty store when no adapter is given -- the in-memory-only walking-skeleton case).

#### Parameters

##### persistence?

[`VehicleSafetyPersistenceAdapter`](../interfaces/VehicleSafetyPersistenceAdapter.md)

#### Returns

`Promise`\<`VehicleSafetyPolicyStore`\>
