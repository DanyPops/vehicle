[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [vehicle-watchers](../README.md) / WatchRegistry

# Class: WatchRegistry

Defined in: [packages/vehicle-core/src/vehicle-watchers.ts:61](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-watchers.ts#L61)

## Constructors

### Constructor

> **new WatchRegistry**(`options?`): `WatchRegistry`

Defined in: [packages/vehicle-core/src/vehicle-watchers.ts:66](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-watchers.ts#L66)

#### Parameters

##### options?

[`WatchRegistryOptions`](../interfaces/WatchRegistryOptions.md) = `{}`

#### Returns

`WatchRegistry`

## Methods

### add()

> **add**(`scope`, `resource`, `watchId`, `topic`): [`WatchRegistration`](../interfaces/WatchRegistration.md)

Defined in: [packages/vehicle-core/src/vehicle-watchers.ts:70](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-watchers.ts#L70)

#### Parameters

##### scope

`string`

##### resource

`string`

##### watchId

`string`

##### topic

`string`

#### Returns

[`WatchRegistration`](../interfaces/WatchRegistration.md)

***

### hasAnyFor()

> **hasAnyFor**(`scope`): `boolean`

Defined in: [packages/vehicle-core/src/vehicle-watchers.ts:93](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-watchers.ts#L93)

False once a scope has zero remaining registrations -- a provider's own signal to release whatever underlying watch/subscription resource that scope was backing.

#### Parameters

##### scope

`string`

#### Returns

`boolean`

***

### registrationsFor()

> **registrationsFor**(`scope`): readonly [`WatchRegistration`](../interfaces/WatchRegistration.md)[]

Defined in: [packages/vehicle-core/src/vehicle-watchers.ts:97](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-watchers.ts#L97)

#### Parameters

##### scope

`string`

#### Returns

readonly [`WatchRegistration`](../interfaces/WatchRegistration.md)[]

***

### remove()

> **remove**(`watchId`): [`WatchRegistration`](../interfaces/WatchRegistration.md) \| `undefined`

Defined in: [packages/vehicle-core/src/vehicle-watchers.ts:82](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-watchers.ts#L82)

The removed registration, or undefined if watchId was already unknown -- idempotent, like the rest of Vehicle's own unregister-shaped operations. Returns the registration itself (not just a boolean) so a caller can tell which scope lost its last watch without a separate lookup.

#### Parameters

##### watchId

`string`

#### Returns

[`WatchRegistration`](../interfaces/WatchRegistration.md) \| `undefined`
