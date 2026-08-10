[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/armada](../../README.md) / [index](../README.md) / VehicleRegistrar

# Interface: VehicleRegistrar

Defined in: [registrar.ts:46](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/registrar.ts#L46)

## Methods

### isRegistered()

> **isRegistered**(`name`): `Promise`\<`boolean`\>

Defined in: [registrar.ts:52](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/registrar.ts#L52)

Whether the manifest currently declares this Vehicle -- registration status alone, not native running/ready state (see status.ts's buildFleetStatus for that). False on any manifest read failure, the same fail-closed default a caller deciding whether to restart/reconcile something should get.

#### Parameters

##### name

`string`

#### Returns

`Promise`\<`boolean`\>

***

### register()

> **register**(`vehicle`): `Promise`\<[`VehicleRegistrationOutcome`](../type-aliases/VehicleRegistrationOutcome.md)\>

Defined in: [registrar.ts:48](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/registrar.ts#L48)

Upserts the Vehicle into the manifest, then reconciles the whole fleet against it -- installs it natively if new, or stops+replaces+restarts it if its declared spec (version, executable, args, ...) drifted from what's currently running. A no-op reconcile (nothing changed) still returns ok:true with an empty applied list.

#### Parameters

##### vehicle

[`VehicleRegistrationInput`](VehicleRegistrationInput.md)

#### Returns

`Promise`\<[`VehicleRegistrationOutcome`](../type-aliases/VehicleRegistrationOutcome.md)\>

***

### unregister()

> **unregister**(`name`): `Promise`\<[`VehicleRegistrationOutcome`](../type-aliases/VehicleRegistrationOutcome.md)\>

Defined in: [registrar.ts:50](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/registrar.ts#L50)

Removes the native service first, then drops the Vehicle from the manifest -- native-first so a failed native removal never leaves the manifest silently claiming a Vehicle that's actually gone. Idempotent: unregistering a name the manifest doesn't know about succeeds with an empty applied list.

#### Parameters

##### name

`string`

#### Returns

`Promise`\<[`VehicleRegistrationOutcome`](../type-aliases/VehicleRegistrationOutcome.md)\>
