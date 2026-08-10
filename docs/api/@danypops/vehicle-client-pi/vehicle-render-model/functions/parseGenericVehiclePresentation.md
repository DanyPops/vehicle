[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-render-model](../README.md) / parseGenericVehiclePresentation

# Function: parseGenericVehiclePresentation()

> **parseGenericVehiclePresentation**(`value`, `maxBytes?`): [`GenericVehiclePresentation`](../interfaces/GenericVehiclePresentation.md) \| `undefined`

Defined in: [packages/vehicle-client-pi/src/vehicle-render-model.ts:341](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-render-model.ts#L341)

Strict, fail-closed replay parser. Unknown versions and malformed/oversized/cyclic values return undefined.

## Parameters

### value

`unknown`

### maxBytes?

`number` = `DEFAULT_PRESENTATION_MAX_BYTES`

## Returns

[`GenericVehiclePresentation`](../interfaces/GenericVehiclePresentation.md) \| `undefined`
