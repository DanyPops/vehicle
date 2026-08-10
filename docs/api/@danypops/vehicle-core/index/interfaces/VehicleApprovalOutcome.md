[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / VehicleApprovalOutcome

# Interface: VehicleApprovalOutcome

Defined in: [packages/vehicle-core/src/vehicle-approvals.ts:46](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-approvals.ts#L46)

Emitted once vehicle.approval.resolve settles a request, whichever way.

## Properties

### comment?

> `readonly` `optional` **comment?**: `string`

Defined in: [packages/vehicle-core/src/vehicle-approvals.ts:52](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-approvals.ts#L52)

Optional human rationale captured by a rich HITL presenter.

***

### decidedAt

> `readonly` **decidedAt**: `number`

Defined in: [packages/vehicle-core/src/vehicle-approvals.ts:49](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-approvals.ts#L49)

***

### decidedBy?

> `readonly` `optional` **decidedBy?**: `string`

Defined in: [packages/vehicle-core/src/vehicle-approvals.ts:50](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-approvals.ts#L50)

***

### decision

> `readonly` **decision**: [`VehicleApprovalDecision`](../type-aliases/VehicleApprovalDecision.md)

Defined in: [packages/vehicle-core/src/vehicle-approvals.ts:48](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-approvals.ts#L48)

***

### requestId

> `readonly` **requestId**: `string`

Defined in: [packages/vehicle-core/src/vehicle-approvals.ts:47](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-approvals.ts#L47)
