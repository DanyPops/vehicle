[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-pi](../README.md) / invokeVehicleOperation

# Function: invokeVehicleOperation()

> **invokeVehicleOperation**(`params`): `Promise`\<[`VehicleOperationInvocationResult`](../interfaces/VehicleOperationInvocationResult.md)\>

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:692](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L692)

The cross-cutting policy layer every registerVehicleTools()-registered tool
gets for free -- activity broadcasting, the local /safety "ask" gate, the
server approval-required retry dance, idempotency-key/correlationId
derivation, resolveInvocation/onInvoked/interactiveFollowUps hooks -- as a
standalone Decorator around a single operation call, independent of how
(or whether) that call is fronted by a Pi tool at all.

Exists because registerVehicleTools()'s one-operation-to-one-tool
projection is a deliberate, correct default (Anthropic's own tool-design
guidance: consolidate related actions behind one tool with an action
parameter, rather than one tool per action) but is not the only legitimate
tool shape -- a consumer whose tool already consolidates several
operations behind an action/operation parameter (see e.g. web-spider's
web_category) cannot use registerVehicleTools() for that tool without
regressing its existing one-tool-many-actions contract into several
separate tools. Before this function existed, the only escape hatch was
calling client.invoke() directly, which silently forfeited every one of
the above cross-cutting behaviors -- exactly the gap this closes: a
consumer keeps full control of its own tool registration/schema/dispatch
shape while still calling through the same policy layer
registerVehicleTools() uses internally.

## Parameters

### params

[`VehicleOperationInvocationParams`](../interfaces/VehicleOperationInvocationParams.md)

## Returns

`Promise`\<[`VehicleOperationInvocationResult`](../interfaces/VehicleOperationInvocationResult.md)\>
