[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-render-model](../README.md) / GenericVehiclePresentationView

# Type Alias: GenericVehiclePresentationView

> **GenericVehiclePresentationView** = \{ `completeness`: [`VehiclePresentationCompleteness`](../interfaces/VehiclePresentationCompleteness.md); `kind`: `"empty"`; \} \| \{ `columns`: readonly `string`[]; `columnsOmitted`: `number`; `completeness`: [`VehiclePresentationCompleteness`](../interfaces/VehiclePresentationCompleteness.md); `fields`: readonly [`VehiclePresentationField`](../interfaces/VehiclePresentationField.md)[]; `kind`: `"table"`; `rows`: readonly readonly `string`[][]; \} \| \{ `completeness`: [`VehiclePresentationCompleteness`](../interfaces/VehiclePresentationCompleteness.md); `fields`: readonly [`VehiclePresentationField`](../interfaces/VehiclePresentationField.md)[]; `items`: readonly `string`[]; `kind`: `"list"`; \} \| \{ `completeness`: [`VehiclePresentationCompleteness`](../interfaces/VehiclePresentationCompleteness.md); `fields`: readonly [`VehiclePresentationField`](../interfaces/VehiclePresentationField.md)[]; `kind`: `"fields"`; \} \| \{ `completeness`: [`VehiclePresentationCompleteness`](../interfaces/VehiclePresentationCompleteness.md); `fields`: readonly [`VehiclePresentationField`](../interfaces/VehiclePresentationField.md)[]; `kind`: `"narrative"`; `text`: `string`; \} \| \{ `completeness`: [`VehiclePresentationCompleteness`](../interfaces/VehiclePresentationCompleteness.md); `kind`: `"json"`; `preview`: `string`; \} \| \{ `completeness`: [`VehiclePresentationCompleteness`](../interfaces/VehiclePresentationCompleteness.md); `kind`: `"progress"`; `max?`: `number`; `text`: `string`; `value?`: `number`; \}

Defined in: [packages/vehicle-client-pi/src/vehicle-render-model.ts:21](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-render-model.ts#L21)
