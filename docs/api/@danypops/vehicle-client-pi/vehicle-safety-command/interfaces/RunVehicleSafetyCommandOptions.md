[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-safety-command](../README.md) / RunVehicleSafetyCommandOptions

# Interface: RunVehicleSafetyCommandOptions

Defined in: [packages/vehicle-client-pi/src/vehicle-safety-command.ts:259](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety-command.ts#L259)

## Properties

### contributors?

> `optional` **contributors?**: () => readonly [`VehicleSafetyContributor`](../../vehicle-safety-registry/interfaces/VehicleSafetyContributor.md)[]

Defined in: [packages/vehicle-client-pi/src/vehicle-safety-command.ts:262](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety-command.ts#L262)

Overridden in tests instead of reaching the real process-wide registry.

#### Returns

readonly [`VehicleSafetyContributor`](../../vehicle-safety-registry/interfaces/VehicleSafetyContributor.md)[]

***

### pickNewState?

> `optional` **pickNewState?**: [`PickNewState`](../type-aliases/PickNewState.md)

Defined in: [packages/vehicle-client-pi/src/vehicle-safety-command.ts:266](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety-command.ts#L266)

***

### pickOperationToEdit?

> `optional` **pickOperationToEdit?**: [`PickOperationToEdit`](../type-aliases/PickOperationToEdit.md)

Defined in: [packages/vehicle-client-pi/src/vehicle-safety-command.ts:265](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety-command.ts#L265)

***

### policyStore

> **policyStore**: [`VehicleSafetyPolicyStore`](../../vehicle-safety/classes/VehicleSafetyPolicyStore.md)

Defined in: [packages/vehicle-client-pi/src/vehicle-safety-command.ts:260](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety-command.ts#L260)

***

### showPanel?

> `optional` **showPanel?**: (`ctx`, `rows`) => `Promise`\<`"edit"` \| `undefined`\>

Defined in: [packages/vehicle-client-pi/src/vehicle-safety-command.ts:264](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-safety-command.ts#L264)

Overridden in tests instead of opening a real ctx.ui.custom overlay.

#### Parameters

##### ctx

`ExtensionCommandContext`

##### rows

readonly [`VehicleSafetyRow`](VehicleSafetyRow.md)[]

#### Returns

`Promise`\<`"edit"` \| `undefined`\>
