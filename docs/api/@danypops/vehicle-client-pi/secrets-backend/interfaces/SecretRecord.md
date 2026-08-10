[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [secrets-backend](../README.md) / SecretRecord

# Interface: SecretRecord

Defined in: [packages/vehicle-client-pi/src/secrets-backend.ts:13](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-backend.ts#L13)

Backend-agnostic port for the [secrets] side of the services/secrets model:
a named credential/profile, wherever it actually lives (env var, local
@danypops/vehicle-server vault.ts-backed file store, or a remote vault
like Enigma). Enigma is one pluggable implementation of this port, not
the assumed target -- a consumer with no Enigma running still gets a
working /secrets command against its own env/local tiers.

Every field on SecretRecord is redaction-safe by construction: there is no
accessToken/refreshToken/extra here at all, so a caller can never
accidentally surface real credential material through this port.

## Properties

### configured

> **configured**: `boolean`

Defined in: [packages/vehicle-client-pi/src/secrets-backend.ts:17](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-backend.ts#L17)

***

### expiresAt?

> `optional` **expiresAt?**: `string`

Defined in: [packages/vehicle-client-pi/src/secrets-backend.ts:18](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-backend.ts#L18)

***

### name

> **name**: `string`

Defined in: [packages/vehicle-client-pi/src/secrets-backend.ts:14](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-backend.ts#L14)

***

### scope?

> `optional` **scope?**: `string`

Defined in: [packages/vehicle-client-pi/src/secrets-backend.ts:19](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-backend.ts#L19)

***

### source

> **source**: `string`

Defined in: [packages/vehicle-client-pi/src/secrets-backend.ts:16](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-backend.ts#L16)

Which backend implementation holds this record, e.g. "env", "local", "enigma".
