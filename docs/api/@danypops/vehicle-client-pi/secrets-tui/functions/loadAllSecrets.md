[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [secrets-tui](../README.md) / loadAllSecrets

# Function: loadAllSecrets()

> **loadAllSecrets**(`backends`): `Promise`\<[`SecretEntry`](../type-aliases/SecretEntry.md)[]\>

Defined in: [packages/vehicle-client-pi/src/secrets-tui.ts:187](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-tui.ts#L187)

Every backend's records. A remote backend's list() can fail mid-session
(the vault daemon restarting, a network blip) -- this always throws
SecretsBackendListError naming which backend failed, rather than a raw
error a caller has to inspect to attribute.

## Parameters

### backends

[`SecretsBackend`](../../secrets-backend/interfaces/SecretsBackend.md)[]

## Returns

`Promise`\<[`SecretEntry`](../type-aliases/SecretEntry.md)[]\>
