[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-pi](../README.md) / PiVehicleInteractiveFollowUp

# Type Alias: PiVehicleInteractiveFollowUp

> **PiVehicleInteractiveFollowUp** = (`request`, `output`, `client`) => `Promise`\<[`PiVehicleFollowUpResult`](../interfaces/PiVehicleFollowUpResult.md) \| `undefined`\>

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:130](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L130)

An optional client-local interactive step run after a successful invoke(),
before the tool result is returned to the model -- for an operation whose
own real UX needs more than "call it, show the output" (e.g. an operation
that durably records something and separately wants to offer a synchronous
human round-trip when ctx.hasUI allows one). Returning undefined falls back
to the default content/details built from the primary output; a thrown
error propagates as a real tool failure -- the primary invoke() already
succeeded and is not rolled back, matching this same contract on any other
mutating operation whose follow-up step fails.

Deliberately distinct from the Approval Gate's own shared local-approval fast path
(baked directly into execute() itself, since every gated operation needs
the identical approval-required/resolve dance): this hook is for a
per-operation, per-consumer interactive shape nothing else shares, the way
Papyrus's discuss.open/discuss.reply use it to offer a live human answer.

## Parameters

### request

[`PiVehicleInvocationRequest`](../interfaces/PiVehicleInvocationRequest.md)

### output

`unknown`

### client

`VehicleClient`

## Returns

`Promise`\<[`PiVehicleFollowUpResult`](../interfaces/PiVehicleFollowUpResult.md) \| `undefined`\>
