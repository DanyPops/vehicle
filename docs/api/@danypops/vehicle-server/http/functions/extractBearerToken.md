[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [http](../README.md) / extractBearerToken

# Function: extractBearerToken()

> **extractBearerToken**(`request`): `string` \| `undefined`

Defined in: [packages/vehicle-server/src/http.ts:17](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/http.ts#L17)

Raw bearer token from the Authorization header, or undefined if absent/malformed. For callers that need to look the token up (e.g. against a registry) rather than compare it to one fixed value.

## Parameters

### request

`Request`

## Returns

`string` \| `undefined`
