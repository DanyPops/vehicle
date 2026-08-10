[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [http](../README.md) / requireBearerToken

# Function: requireBearerToken()

> **requireBearerToken**(`request`, `token`): `boolean`

Defined in: [packages/vehicle-server/src/http.ts:12](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/http.ts#L12)

Shared HTTP scaffolding for a daemon's `fetch(request): Promise<Response>`
handler: Bearer-token auth and the JSON/health response shapes that were
hand-rolled, verbatim, in every daemon's service.ts.

No routing framework here on purpose -- each daemon has a handful of
routes; a router/RPC framework would add more surface than the ~10 lines
per daemon it would replace (see the off-the-shelf-modules research this
was scoped against).

## Parameters

### request

`Request`

### token

`string`

## Returns

`boolean`
