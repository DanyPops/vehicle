[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [service](../README.md) / detectLinuxInitSystem

# Function: detectLinuxInitSystem()

> **detectLinuxInitSystem**(`which`): `string` \| `null`

Defined in: [packages/vehicle-server/src/service.ts:58](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/service.ts#L58)

Binary-presence detection (not process.platform alone) -- correctly distinguishes systemd from openrc/upstart/systemv Linux hosts.

## Parameters

### which

(`binary`) => `boolean`

## Returns

`string` \| `null`
