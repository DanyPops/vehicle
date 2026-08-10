[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-core](../../README.md) / [index](../README.md) / VEHICLE\_APPROVAL\_RESOLVE\_OPERATION\_NAME

# Variable: VEHICLE\_APPROVAL\_RESOLVE\_OPERATION\_NAME

> `const` **VEHICLE\_APPROVAL\_RESOLVE\_OPERATION\_NAME**: `"vehicle.approval.resolve"` = `"vehicle.approval.resolve"`

Defined in: [packages/vehicle-core/src/vehicle-approvals.ts:25](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-core/src/vehicle-approvals.ts#L25)

The name VehicleRegistry.configureApprovals() registers its built-in
grant/deny operation under. Shared so vehicle-client-pi can recognize and
exclude it from Pi tool projection by exact name (see its own use site):
it is invoked only via this package's own approval-required retry dance
using the extension's already-fixed permissions, never meant to be a
model-callable tool -- a model that could call it directly would be able
to grant its own pending approval requests, defeating the human-in-the-
loop point of the gate entirely.
