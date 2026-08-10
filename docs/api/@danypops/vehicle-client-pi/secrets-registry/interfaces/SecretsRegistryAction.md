[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [secrets-registry](../README.md) / SecretsRegistryAction

# Interface: SecretsRegistryAction

Defined in: [packages/vehicle-client-pi/src/secrets-registry.ts:28](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-registry.ts#L28)

An action appended to the merged [secrets] menu -- e.g. a vendor's own
login wizard, too specific for the generic SecretsBackend port to model.
Type-only import above, so this file carries no runtime dependency on
pi-coding-agent; structurally identical to secrets-tui.ts's own
SecretsMenuAction (same fields, same types) so values flow between the
two without a real (value-level) circular import between the files.

## Properties

### description?

> `optional` **description?**: `string`

Defined in: [packages/vehicle-client-pi/src/secrets-registry.ts:31](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-registry.ts#L31)

***

### label

> **label**: `string`

Defined in: [packages/vehicle-client-pi/src/secrets-registry.ts:30](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-registry.ts#L30)

***

### run

> **run**: (`ctx`) => `Promise`\<`void`\>

Defined in: [packages/vehicle-client-pi/src/secrets-registry.ts:32](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-registry.ts#L32)

#### Parameters

##### ctx

`ExtensionCommandContext`

#### Returns

`Promise`\<`void`\>

***

### value

> **value**: `string`

Defined in: [packages/vehicle-client-pi/src/secrets-registry.ts:29](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-registry.ts#L29)
