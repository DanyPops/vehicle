[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [vehicle-registry](../README.md) / VehicleRegistry

# Class: VehicleRegistry

Defined in: [packages/vehicle-server/src/vehicle-registry.ts:317](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-registry.ts#L317)

The daemon-side execution engine at the root of `@danypops/vehicle-server`:
operation registration, permission/deadline/payload enforcement, an
injectable [VehicleExecutionPolicy](../interfaces/VehicleExecutionPolicy.md) hook, and
`setAvailability(name, version, available, reason?)`, which toggles a
registered operation's usability at runtime (e.g. a credential got
configured or removed) -- there's no unregister; an operation's shape is
permanent once registered, only whether `manifest()` reports it available
and whether `invoke()` accepts it.

Kept separate from `./http`'s `createVehicleHttpApp()` (which exposes a
registry over `GET /vehicle/manifest`, `POST /vehicle/invoke`, and
`POST /vehicle/cancel`) on purpose: a consumer that only builds/tests a
registry never pulls in HTTP request/response plumbing.

## Constructors

### Constructor

> **new VehicleRegistry**(`identity`, `executionPolicy?`): `VehicleRegistry`

Defined in: [packages/vehicle-server/src/vehicle-registry.ts:328](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-registry.ts#L328)

#### Parameters

##### identity

[`VehicleRegistryIdentity`](../type-aliases/VehicleRegistryIdentity.md)

##### executionPolicy?

[`VehicleExecutionPolicy`](../interfaces/VehicleExecutionPolicy.md)

#### Returns

`VehicleRegistry`

## Methods

### configureApprovals()

> **configureApprovals**(`options?`): `void`

Defined in: [packages/vehicle-server/src/vehicle-registry.ts:360](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-registry.ts#L360)

Opt-in only -- never called automatically, so a Vehicle that never
configures approvals keeps today's exact manifest shape and invoke()
behavior (no gating at all). Registers the two built-in approval
events and the vehicle.approval.resolve operation at call time (not
construction), so they only ever appear in a manifest for a Vehicle
that actually uses them.

#### Parameters

##### options?

[`VehicleApprovalPolicyOptions`](../interfaces/VehicleApprovalPolicyOptions.md) = `{}`

#### Returns

`void`

***

### emit()

> **emit**(`name`, `version`, `payload`): `void`

Defined in: [packages/vehicle-server/src/vehicle-registry.ts:596](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-registry.ts#L596)

Validates payload against the declared event's own schema and byte-size
limit (same bounded-resource discipline invoke() applies to a
request/response), then notifies every current local listener --
both a direct subscribeLocal() caller (LocalVehicleClient) and any
wildcard bridge (subscribeAll(), e.g. bridgeVehicleEventsToPushChannel
for remote delivery). A throwing listener is swallowed so one bad
subscriber can never break emit() for every other subscriber or the
handler that's emitting.

#### Parameters

##### name

`string`

##### version

`number`

##### payload

`unknown`

#### Returns

`void`

***

### invoke()

> **invoke**(`name`, `version`, `input`, `options?`): `Promise`\<`unknown`\>

Defined in: [packages/vehicle-server/src/vehicle-registry.ts:675](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-registry.ts#L675)

#### Parameters

##### name

`string`

##### version

`number`

##### input

`unknown`

##### options?

`VehicleInvocationOptions` = `{}`

#### Returns

`Promise`\<`unknown`\>

***

### manifest()

> **manifest**(): `VehicleManifest`

Defined in: [packages/vehicle-server/src/vehicle-registry.ts:659](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-registry.ts#L659)

#### Returns

`VehicleManifest`

***

### ownerOf()

> **ownerOf**(`name`, `version`): `string` \| `undefined`

Defined in: [packages/vehicle-server/src/vehicle-registry.ts:563](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-registry.ts#L563)

#### Parameters

##### name

`string`

##### version

`number`

#### Returns

`string` \| `undefined`

***

### register()

> **register**\<`Input`, `Output`\>(`owner`, `binding`): `void`

Defined in: [packages/vehicle-server/src/vehicle-registry.ts:538](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-registry.ts#L538)

#### Type Parameters

##### Input

`Input`

##### Output

`Output`

#### Parameters

##### owner

`string`

##### binding

`VehicleOperationBinding`\<`Input`, `Output`\>

#### Returns

`void`

***

### registerEvent()

> **registerEvent**\<`Payload`\>(`owner`, `event`): `void`

Defined in: [packages/vehicle-server/src/vehicle-registry.ts:568](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-registry.ts#L568)

Declares a named, schema'd event type a handler can later emit() -- the typed replacement for a raw PushChannel.publish() call with a hand-invented topic string.

#### Type Parameters

##### Payload

`Payload`

#### Parameters

##### owner

`string`

##### event

`VehicleEvent`\<`Payload`\>

#### Returns

`void`

***

### resolveForBackground()

> **resolveForBackground**(`name`, `version`, `input`, `options?`): [`VehicleBackgroundResolution`](../interfaces/VehicleBackgroundResolution.md)

Defined in: [packages/vehicle-server/src/vehicle-registry.ts:795](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-registry.ts#L795)

Same validation as invoke(), minus awaiting the handler -- the seam VehicleJobStore needs. Kept separate so it can't regress invoke()'s tested behavior.

#### Parameters

##### name

`string`

##### version

`number`

##### input

`unknown`

##### options?

[`VehicleBackgroundResolutionOptions`](../interfaces/VehicleBackgroundResolutionOptions.md) = `{}`

#### Returns

[`VehicleBackgroundResolution`](../interfaces/VehicleBackgroundResolution.md)

***

### setAvailability()

> **setAvailability**(`name`, `version`, `available`, `reason?`): `void`

Defined in: [packages/vehicle-server/src/vehicle-registry.ts:653](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-registry.ts#L653)

Marks a registered operation available or unavailable on this running
instance -- e.g. a provider whose credential just got configured or
removed. There is no unregister(): an operation's shape is permanent
once registered (mirroring Pi's own tool model, which has no
unregisterTool() either), only its usability toggles. invoke() refuses
an unavailable operation; manifest() reports it with available:false so
a client-side projection (see vehicle-pi.ts) can hide it from the LLM
before ever attempting a call.

#### Parameters

##### name

`string`

##### version

`number`

##### available

`boolean`

##### reason?

`string`

#### Returns

`void`

***

### setExecutionPolicy()

> **setExecutionPolicy**(`policy`): `void`

Defined in: [packages/vehicle-server/src/vehicle-registry.ts:342](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-registry.ts#L342)

#### Parameters

##### policy

[`VehicleExecutionPolicy`](../interfaces/VehicleExecutionPolicy.md)

#### Returns

`void`

***

### setExposeHandlerFailureDetails()

> **setExposeHandlerFailureDetails**(`enabled`): `void`

Defined in: [packages/vehicle-server/src/vehicle-registry.ts:348](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-registry.ts#L348)

Includes an unexpected handler/policy exception's message in toFailure().causeMessage. Only enable once this Vehicle's own handlers are reviewed for leak risk.

#### Parameters

##### enabled

`boolean`

#### Returns

`void`

***

### subscribeAll()

> **subscribeAll**(`listener`): () => `void`

Defined in: [packages/vehicle-server/src/vehicle-registry.ts:638](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-registry.ts#L638)

Every current and future emit(), regardless of event name -- the seam bridgeVehicleEventsToPushChannel uses so a bridge set up once forwards every event a provider declares, including ones registered after the bridge itself.

#### Parameters

##### listener

(`name`, `version`, `payload`) => `void`

#### Returns

() => `void`

***

### subscribeLocal()

> **subscribeLocal**(`name`, `version`, `listener`): () => `void`

Defined in: [packages/vehicle-server/src/vehicle-registry.ts:622](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-registry.ts#L622)

In-process subscription to one declared event, scoped to a caller that already knows its exact name/version -- what LocalVehicleClient.subscribe() is built on. Throws not-found the same way invoke() does for an unregistered operation, rather than silently listening for something that can never fire.

#### Parameters

##### name

`string`

##### version

`number`

##### listener

(`payload`) => `void`

#### Returns

() => `void`
