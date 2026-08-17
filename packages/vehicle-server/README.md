# @danypops/vehicle-server

The Vehicle server substrate: a supervised, authenticated, loopback-only
daemon (process lifecycle, SQLite storage, structured logging, OS service
install, credential vault, process supervision) plus `VehicleRegistry`
(registration, permission/deadline/payload enforcement, availability,
execution policy) at `.` and its authenticated HTTP hosting surface at
`./http`. A Vehicle IS this daemon -- a long-running service purpose-built
to serve AI agents tools.

```bash
bun add @danypops/vehicle-server @danypops/vehicle-core
```

Every other module (`./paths`, `./storage`, `./logging`, `./rpc-http`,
`./daemon`, `./service`, `./supervisor`, `./process-supervisor`, `./vault`,
`./session-identity`, `./unix-peer-cred`, `./unix-rpc-server`,
`./push-channel`, `./version`, `./metrics`, `./metrics-middleware`,
`./metrics-operations`) is independently importable, so a consumer only
pulls in what it uses.

## Tool/operation usage metrics

`./metrics` (`openVehicleMetricsStore`) is a forever-retained, indexed,
time-range-queryable SQLite record of every real operation invocation this
Vehicle has served -- how much each operation is used, and by which agent
(`callerSessionId`). Wire it into a running registry with two calls:

```ts
import { VehicleRegistry } from "@danypops/vehicle-server";
import { openVehicleMetricsStore } from "@danypops/vehicle-server/metrics";
import { createVehicleMetricsMiddleware } from "@danypops/vehicle-server/metrics-middleware";
import { registerVehicleMetricsOperations } from "@danypops/vehicle-server/metrics-operations";

const store = openVehicleMetricsStore(paths.metrics); // paths from resolveDaemonPaths()
registry.useExecutionMiddleware(createVehicleMetricsMiddleware(store, "my-vehicle"));
registerVehicleMetricsOperations(registry, store, "my-vehicle");
```

This registers `my-vehicle:metrics.query` (discoverable through the same
`tools_list`/`tools_man` path as every other operation) and
`my-vehicle:metrics.recordClientEvent` -- the one write path a client (e.g.
vehicle-client-pi's Vehicle Shell) uses to report a `tools_list`/`tools_man`/
`tools_type` call it observed, since those never themselves reach this
daemon's `invoke()` path. Every real operation invocation (including
`metrics.query`/`metrics.recordClientEvent` themselves) is captured
automatically by the middleware -- no other wiring needed.

See the [workspace README](https://github.com/DanyPops/vehicle#readme) for
the full module table and Vehicle package layout.
