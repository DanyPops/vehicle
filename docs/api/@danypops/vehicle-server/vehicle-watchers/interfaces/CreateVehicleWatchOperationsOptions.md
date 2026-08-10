[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [vehicle-watchers](../README.md) / CreateVehicleWatchOperationsOptions

# Interface: CreateVehicleWatchOperationsOptions

Defined in: [packages/vehicle-server/src/vehicle-watchers.ts:93](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-watchers.ts#L93)

## Properties

### limits

> `readonly` **limits**: `VehicleLimits`

Defined in: [packages/vehicle-server/src/vehicle-watchers.ts:99](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-watchers.ts#L99)

***

### name

> `readonly` **name**: `string`

Defined in: [packages/vehicle-server/src/vehicle-watchers.ts:95](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-watchers.ts#L95)

Names the operation family: produces "${name}.watch" and "${name}.unwatch".

***

### permissions?

> `readonly` `optional` **permissions?**: readonly `string`[]

Defined in: [packages/vehicle-server/src/vehicle-watchers.ts:100](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-watchers.ts#L100)

***

### registry

> `readonly` **registry**: `WatchRegistry`

Defined in: [packages/vehicle-server/src/vehicle-watchers.ts:98](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-watchers.ts#L98)

***

### scopeOf?

> `readonly` `optional` **scopeOf?**: (`context`) => `string`

Defined in: [packages/vehicle-server/src/vehicle-watchers.ts:107](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-watchers.ts#L107)

Derives the bounding scope a watch counts against (WatchRegistry's own
per-scope cap). Defaults to one fixed shared scope -- the walking
skeleton's own single-bucket shape; override for real per-workspace or
per-principal bounding once a provider needs it.

#### Parameters

##### context

`VehicleOperationContext`\<[`VehicleWatchInput`](VehicleWatchInput.md)\>

#### Returns

`string`

***

### version?

> `readonly` `optional` **version?**: `number`

Defined in: [packages/vehicle-server/src/vehicle-watchers.ts:97](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-watchers.ts#L97)

Defaults to 1.
