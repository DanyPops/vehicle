[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/armada](../../README.md) / [index](../README.md) / VehicleRegistrationInput

# Interface: VehicleRegistrationInput

Defined in: [registrar.ts:24](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/registrar.ts#L24)

Pre-validation input shape for register() -- name/executable/handlePath are plain strings here; upsertManifestVehicle's own decodeArmadaManifest is still the single source of truth for validating and branding them.

## Properties

### arguments?

> `readonly` `optional` **arguments?**: readonly `string`[]

Defined in: [registrar.ts:28](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/registrar.ts#L28)

***

### executable

> `readonly` **executable**: `string`

Defined in: [registrar.ts:27](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/registrar.ts#L27)

***

### handlePath

> `readonly` **handlePath**: `string`

Defined in: [registrar.ts:30](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/registrar.ts#L30)

***

### name

> `readonly` **name**: `string`

Defined in: [registrar.ts:25](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/registrar.ts#L25)

***

### readiness

> `readonly` **readiness**: `object`

Defined in: [registrar.ts:32](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/registrar.ts#L32)

#### pollIntervalMs

> `readonly` **pollIntervalMs**: `number`

#### timeoutMs

> `readonly` **timeoutMs**: `number`

***

### resources?

> `readonly` `optional` **resources?**: [`VehicleResources`](VehicleResources.md)

Defined in: [registrar.ts:33](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/registrar.ts#L33)

***

### restart

> `readonly` **restart**: [`VehicleRestartPolicy`](../type-aliases/VehicleRestartPolicy.md)

Defined in: [registrar.ts:31](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/registrar.ts#L31)

***

### runtime?

> `readonly` `optional` **runtime?**: [`VehicleRuntimeRequirements`](VehicleRuntimeRequirements.md)

Defined in: [registrar.ts:34](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/registrar.ts#L34)

***

### version

> `readonly` **version**: `string`

Defined in: [registrar.ts:26](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/registrar.ts#L26)

***

### workingDirectory?

> `readonly` `optional` **workingDirectory?**: `string`

Defined in: [registrar.ts:29](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/registrar.ts#L29)
