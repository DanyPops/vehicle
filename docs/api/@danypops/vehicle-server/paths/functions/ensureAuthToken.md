[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [paths](../README.md) / ensureAuthToken

# Function: ensureAuthToken()

> **ensureAuthToken**(`tokenPath`, `errorLabel`): `string`

Defined in: [packages/vehicle-server/src/paths.ts:123](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/paths.ts#L123)

Loads the auth token, creating a fresh 256-bit one on first run.

## Parameters

### tokenPath

`string`

### errorLabel

`string`

used only in the invalid-token error message, e.g. "Web Spider".

## Returns

`string`
