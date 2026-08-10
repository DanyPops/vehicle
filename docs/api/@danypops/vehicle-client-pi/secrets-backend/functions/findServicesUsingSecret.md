[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [secrets-backend](../README.md) / findServicesUsingSecret

# Function: findServicesUsingSecret()

> **findServicesUsingSecret**(`services`, `secretName`): [`ServiceRecord`](../interfaces/ServiceRecord.md)[]

Defined in: [packages/vehicle-client-pi/src/secrets-backend.ts:68](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-backend.ts#L68)

Which services reference a given secret name -- the reverse of ServiceRecord.backends, absent as a first-class query until now.

## Parameters

### services

[`ServiceRecord`](../interfaces/ServiceRecord.md)[]

### secretName

`string`

## Returns

[`ServiceRecord`](../interfaces/ServiceRecord.md)[]
