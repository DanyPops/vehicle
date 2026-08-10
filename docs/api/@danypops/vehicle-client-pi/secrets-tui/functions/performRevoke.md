[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [secrets-tui](../README.md) / performRevoke

# Function: performRevoke()

> **performRevoke**(`ctx`, `backend`, `name`): `Promise`\<`boolean`\>

Defined in: [packages/vehicle-client-pi/src/secrets-tui.ts:226](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-tui.ts#L226)

Resolves true if the credential was actually revoked (confirmed and no error), false if declined or failed.

## Parameters

### ctx

`ExtensionCommandContext`

### backend

[`SecretsBackend`](../../secrets-backend/interfaces/SecretsBackend.md)

### name

`string`

## Returns

`Promise`\<`boolean`\>
