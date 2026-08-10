[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [hitl-prompt](../README.md) / requestPiApproval

# Function: requestPiApproval()

> **requestPiApproval**(`context`, `options`): `Promise`\<[`PiApprovalAnswer`](../interfaces/PiApprovalAnswer.md) \| `null`\>

Defined in: [packages/vehicle-client-pi/src/hitl-prompt.ts:175](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/hitl-prompt.ts#L175)

Presents one shared approval experience in either of Pi's supported HITL hosts.
RPC/headless or partial UI implementations retain the native confirm fallback.

## Parameters

### context

[`PiHitlContext`](../type-aliases/PiHitlContext.md)

### options

[`PiApprovalPromptOptions`](../interfaces/PiApprovalPromptOptions.md)

## Returns

`Promise`\<[`PiApprovalAnswer`](../interfaces/PiApprovalAnswer.md) \| `null`\>
