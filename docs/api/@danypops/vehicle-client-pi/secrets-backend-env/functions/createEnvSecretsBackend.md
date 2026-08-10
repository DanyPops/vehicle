[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [secrets-backend-env](../README.md) / createEnvSecretsBackend

# Function: createEnvSecretsBackend()

> **createEnvSecretsBackend**(`mapping`, `env?`): [`SecretsBackend`](../../secrets-backend/interfaces/SecretsBackend.md)

Defined in: [packages/vehicle-client-pi/src/secrets-backend-env.ts:14](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-backend-env.ts#L14)

`mapping` is secretName -> the env var that backs it, e.g. { github: "GITHUB_TOKEN" }.

## Parameters

### mapping

`Record`\<`string`, `string`\>

### env?

`ProcessEnv` = `process.env`

## Returns

[`SecretsBackend`](../../secrets-backend/interfaces/SecretsBackend.md)
