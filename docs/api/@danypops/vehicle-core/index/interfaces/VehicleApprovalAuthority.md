[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / VehicleApprovalAuthority

# Interface: VehicleApprovalAuthority

Defined in: [packages/vehicle-core/src/vehicle-approvals.ts:65](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-approvals.ts#L65)

The real authority behind an approvalCapability -- replaces today's
"any non-empty string satisfies it" rubber stamp. mint() is called only
from inside vehicle.approval.resolve once a decision is actually made;
verify() is called from invoke() itself against whatever capability the
caller presents. A capability is scoped to the exact operation+input it
was minted for and expires with its originating request -- presenting a
capability minted for a different operation, a different input, or one
already consumed (single-use) must fail verify().

## Methods

### mint()

> **mint**(`request`): `string`

Defined in: [packages/vehicle-core/src/vehicle-approvals.ts:66](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-approvals.ts#L66)

#### Parameters

##### request

`Pick`\<[`VehicleApprovalRequest`](VehicleApprovalRequest.md), `"requestId"` \| `"operationName"` \| `"operationVersion"` \| `"expiresAt"` \| `"inputHash"`\>

#### Returns

`string`

***

### verify()

> **verify**(`capability`, `operationName`, `operationVersion`, `inputHash`): `boolean`

Defined in: [packages/vehicle-core/src/vehicle-approvals.ts:67](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-approvals.ts#L67)

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
