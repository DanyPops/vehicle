[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [vehicle-approval-authority](../README.md) / HmacApprovalAuthority

# Class: HmacApprovalAuthority

Defined in: [packages/vehicle-server/src/vehicle-approval-authority.ts:23](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-approval-authority.ts#L23)

## Implements

- `VehicleApprovalAuthority`

## Constructors

### Constructor

> **new HmacApprovalAuthority**(`secret?`): `HmacApprovalAuthority`

Defined in: [packages/vehicle-server/src/vehicle-approval-authority.ts:27](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-approval-authority.ts#L27)

#### Parameters

##### secret?

`Buffer`\<`ArrayBufferLike`\>

#### Returns

`HmacApprovalAuthority`

## Methods

### mint()

> **mint**(`request`): `string`

Defined in: [packages/vehicle-server/src/vehicle-approval-authority.ts:31](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-approval-authority.ts#L31)

#### Parameters

##### request

`Pick`\<`VehicleApprovalRequest`, `"requestId"` \| `"operationName"` \| `"operationVersion"` \| `"expiresAt"` \| `"inputHash"`\>

#### Returns

`string`

#### Implementation of

`VehicleApprovalAuthority.mint`

***

### verify()

> **verify**(`capability`, `operationName`, `operationVersion`, `inputHash`): `boolean`

Defined in: [packages/vehicle-server/src/vehicle-approval-authority.ts:36](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-approval-authority.ts#L36)

#### Parameters

##### capability

`string`

##### operationName

`string`

##### operationVersion

`number`

##### inputHash

`string`

#### Returns

`boolean`

#### Implementation of

`VehicleApprovalAuthority.verify`
