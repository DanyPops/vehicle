[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / VEHICLE\_SCHEMA\_PRESENTATION\_EXTENSION

# Variable: VEHICLE\_SCHEMA\_PRESENTATION\_EXTENSION

> `const` **VEHICLE\_SCHEMA\_PRESENTATION\_EXTENSION**: `"x-vehicle-presentation"`

Defined in: [packages/vehicle-core/src/vehicle-contract.ts:33](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-contract.ts#L33)

JSON Schema property annotation consumed by human-facing Vehicle adapters.
`omit` hides the field; `summarize` may show shape/size but never its value.
Standard `writeOnly: true` and `format: "password"` always imply omission.
