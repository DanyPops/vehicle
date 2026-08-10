[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [session-identity](../README.md) / SessionIdentityStore

# Interface: SessionIdentityStore

Defined in: [packages/vehicle-server/src/session-identity.ts:36](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/session-identity.ts#L36)

Storage port a consuming daemon implements against its own persistence layer.

## Methods

### count()

> **count**(): `number`

Defined in: [packages/vehicle-server/src/session-identity.ts:42](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/session-identity.ts#L42)

Total registered rows, so the caller can enforce its own bound (this module does not cap storage itself).

#### Returns

`number`

***

### find()

> **find**(`sessionId`): [`SessionIdentityRecord`](SessionIdentityRecord.md) \| `undefined`

Defined in: [packages/vehicle-server/src/session-identity.ts:37](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/session-identity.ts#L37)

#### Parameters

##### sessionId

`string`

#### Returns

[`SessionIdentityRecord`](SessionIdentityRecord.md) \| `undefined`

***

### remove()

> **remove**(`sessionId`): `void`

Defined in: [packages/vehicle-server/src/session-identity.ts:39](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/session-identity.ts#L39)

#### Parameters

##### sessionId

`string`

#### Returns

`void`

***

### touch()

> **touch**(`sessionId`, `lastSeenAt`): `void`

Defined in: [packages/vehicle-server/src/session-identity.ts:40](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/session-identity.ts#L40)

#### Parameters

##### sessionId

`string`

##### lastSeenAt

`string`

#### Returns

`void`

***

### upsert()

> **upsert**(`record`): `void`

Defined in: [packages/vehicle-server/src/session-identity.ts:38](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/session-identity.ts#L38)

#### Parameters

##### record

[`SessionIdentityRecord`](SessionIdentityRecord.md)

#### Returns

`void`
