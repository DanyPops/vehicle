[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [secrets-backend-local](../README.md) / LocalSecretsBackendOptions

# Interface: LocalSecretsBackendOptions

Defined in: [packages/vehicle-client-pi/src/secrets-backend-local.ts:28](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-backend-local.ts#L28)

## Properties

### dir

> **dir**: `string`

Defined in: [packages/vehicle-client-pi/src/secrets-backend-local.ts:29](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-backend-local.ts#L29)

***

### masterKey?

> `optional` **masterKey?**: `Buffer`\<`ArrayBufferLike`\>

Defined in: [packages/vehicle-client-pi/src/secrets-backend-local.ts:31](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-backend-local.ts#L31)

When given, every file is read/written through createEncryptedFileStore (AES-256-GCM) instead of plaintext.
