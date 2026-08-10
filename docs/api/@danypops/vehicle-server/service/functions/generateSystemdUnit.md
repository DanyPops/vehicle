[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [service](../README.md) / generateSystemdUnit

# Function: generateSystemdUnit()

> **generateSystemdUnit**(`spec`): `string`

Defined in: [packages/vehicle-server/src/service.ts:81](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/service.ts#L81)

Pure text generator -- a systemd --user unit that starts on login and stays a plain one-shot start, no Restart= (see the module doc comment for why).

## Parameters

### spec

[`ServiceSpec`](../interfaces/ServiceSpec.md)

## Returns

`string`
