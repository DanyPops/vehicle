[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [secrets-tui](../README.md) / SecretsMenuAction

# Interface: SecretsMenuAction

Defined in: [packages/vehicle-client-pi/src/secrets-tui.ts:130](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-tui.ts#L130)

An action appended to the [secrets] menu that isn't a SecretRecord at all -- e.g. Enigma's own "+ Log in a backend", whose OAuth-device-flow/static-token registration is too vendor-specific for the generic SecretsBackend port to model.

## Properties

### description?

> `optional` **description?**: `string`

Defined in: [packages/vehicle-client-pi/src/secrets-tui.ts:133](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-tui.ts#L133)

***

### label

> **label**: `string`

Defined in: [packages/vehicle-client-pi/src/secrets-tui.ts:132](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-tui.ts#L132)

***

### run

> **run**: (`ctx`) => `Promise`\<`void`\>

Defined in: [packages/vehicle-client-pi/src/secrets-tui.ts:134](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-tui.ts#L134)

#### Parameters

##### ctx

`ExtensionCommandContext`

#### Returns

`Promise`\<`void`\>

***

### value

> **value**: `string`

Defined in: [packages/vehicle-client-pi/src/secrets-tui.ts:131](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-tui.ts#L131)
