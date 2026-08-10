[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [secrets-backend](../README.md) / SecretsBackend

# Interface: SecretsBackend

Defined in: [packages/vehicle-client-pi/src/secrets-backend.ts:29](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-backend.ts#L29)

## Properties

### source

> `readonly` **source**: `string`

Defined in: [packages/vehicle-client-pi/src/secrets-backend.ts:30](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-backend.ts#L30)

## Methods

### get()

> **get**(`name`): `Promise`\<[`SecretRecord`](SecretRecord.md) \| `undefined`\>

Defined in: [packages/vehicle-client-pi/src/secrets-backend.ts:32](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-backend.ts#L32)

#### Parameters

##### name

`string`

#### Returns

`Promise`\<[`SecretRecord`](SecretRecord.md) \| `undefined`\>

***

### list()

> **list**(): `Promise`\<[`SecretRecord`](SecretRecord.md)[]\>

Defined in: [packages/vehicle-client-pi/src/secrets-backend.ts:31](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-backend.ts#L31)

#### Returns

`Promise`\<[`SecretRecord`](SecretRecord.md)[]\>

***

### reveal()

> **reveal**(`name`): `Promise`\<`Record`\<`string`, `unknown`\> \| `undefined`\>

Defined in: [packages/vehicle-client-pi/src/secrets-backend.ts:46](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-backend.ts#L46)

The real, unredacted record -- accessToken/refreshToken/extra, whatever
the backend actually holds. Deliberately a real port member (not an
afterthought bolted onto the UI): every backend either supports it
genuinely or throws SecretsBackendUnsupportedOperationError, the same
contract rotate/revoke already use. The caller (secrets-tui.ts's
performReveal) is responsible for only ever invoking this from a real
interactive terminal session, never a scripted/RPC one.

#### Parameters

##### name

`string`

#### Returns

`Promise`\<`Record`\<`string`, `unknown`\> \| `undefined`\>

***

### revoke()

> **revoke**(`name`): `Promise`\<`void`\>

Defined in: [packages/vehicle-client-pi/src/secrets-backend.ts:36](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-backend.ts#L36)

Throws SecretsBackendUnsupportedOperationError for a backend with no delete mechanism.

#### Parameters

##### name

`string`

#### Returns

`Promise`\<`void`\>

***

### rotate()

> **rotate**(`name`): `Promise`\<`void`\>

Defined in: [packages/vehicle-client-pi/src/secrets-backend.ts:34](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-backend.ts#L34)

Throws SecretsBackendUnsupportedOperationError for a backend with no rotation mechanism (e.g. a plain env var).

#### Parameters

##### name

`string`

#### Returns

`Promise`\<`void`\>
