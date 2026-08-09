# @danypops/vehicle-conformance

Host-neutral `bun:test` conformance suite for any `VehicleClient`
implementation -- one shared assertion set that a `LocalVehicleClient`, a
`RemoteVehicleClient`, or any future transport must satisfy identically.
Ships raw TypeScript; a test-time devDependency, not a runtime library.

```bash
bun add -d @danypops/vehicle-conformance
```

```ts
import {
  registerConformanceOperations,
  runVehicleClientConformance,
  runToolShellDualChannelConformance,
} from "@danypops/vehicle-conformance";
```

`runToolShellDualChannelConformance(fixture)` is the host-neutral Tool Shell
matrix. A fixture adapts one provider's real projection/rendering boundary via
`execute`, `render`, `replay`, `renderCall`, and `invalidProjection`; the shared
suite checks independent model/presentation sentinels and named bounds,
JSON-safe secret-free details, malformed/unknown replay fallback, collapsed vs.
expanded immutability, schema-sensitive call rendering, 40/80/120-column
physical-line safety, partial output, and projector exception policy. Pi-specific
component construction stays in the adapter fixture rather than this package.

See the [workspace README](https://github.com/DanyPops/vehicle#readme) for
the full Vehicle package layout.
