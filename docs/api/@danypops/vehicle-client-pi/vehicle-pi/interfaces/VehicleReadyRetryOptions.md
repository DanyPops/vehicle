[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-pi](../README.md) / VehicleReadyRetryOptions

# Interface: VehicleReadyRetryOptions

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:1162](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L1162)

## Properties

### attempts?

> `readonly` `optional` **attempts?**: `number`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:1164](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L1164)

Total attempts across the whole resolve+register sequence, including the first. Defaults to 6.

***

### growFactor?

> `readonly` `optional` **growFactor?**: `number`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:1170](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L1170)

Multiplier applied to the delay after each failed attempt. Defaults to 2.

***

### initialDelayMs?

> `readonly` `optional` **initialDelayMs?**: `number`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:1166](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L1166)

Delay before the second attempt. Defaults to 250ms.

***

### maxDelayMs?

> `readonly` `optional` **maxDelayMs?**: `number`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:1168](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L1168)

No retry delay is ever allowed to exceed this. Defaults to 5000ms.
