[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-pi](../README.md) / RegisterVehicleToolsHandshakeOptions

# Interface: RegisterVehicleToolsHandshakeOptions

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:263](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L263)

## Properties

### attempts?

> `readonly` `optional` **attempts?**: `number`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:265](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L265)

Total attempts at the initial manifest fetch, including the first. Defaults to 4.

***

### growFactor?

> `readonly` `optional` **growFactor?**: `number`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:271](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L271)

Multiplier applied to the delay after each failed attempt. Defaults to 2.5.

***

### initialDelayMs?

> `readonly` `optional` **initialDelayMs?**: `number`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:267](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L267)

Delay before the second attempt. Defaults to 50ms.

***

### maxDelayMs?

> `readonly` `optional` **maxDelayMs?**: `number`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:269](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L269)

No retry delay is ever allowed to exceed this. Defaults to 500ms.
