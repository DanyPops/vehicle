[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [activity-broker](../README.md) / VehicleActivitySeverity

# Type Alias: VehicleActivitySeverity

> **VehicleActivitySeverity** = `"debug"` \| `"info"` \| `"success"` \| `"warning"` \| `"error"`

Defined in: [packages/vehicle-client-pi/src/activity-broker.ts:13](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/activity-broker.ts#L13)

Cross-extension, best-effort side-channel for structured telemetry --
ported from vstack's (github.com/vanillagreencom/vstack) pi-background-tasks
activity broker. Completely decoupled from the chat transcript: a
publishing Vehicle and a subscribing dashboard/logger extension never
import each other, they just agree on this symbol and the event shape.

Opt-in by construction: publishing is a true no-op until some other
extension actually registers a broker on globalThis. No Vehicle consumer
pays any cost (beyond one symbol lookup) unless something is listening.
