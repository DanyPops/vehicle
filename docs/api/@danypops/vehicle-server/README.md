[**Documentation**](../../README.md)

***

[Documentation](../../README.md) / @danypops/vehicle-server

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
`./push-channel`, `./version`) is independently importable, so a consumer
only pulls in what it uses.

See the [workspace README](https://github.com/DanyPops/vehicle#readme) for
the full module table and Vehicle package layout.

## Modules

- [atomic-json-node](atomic-json-node/README.md)
- [daemon](daemon/README.md)
- [daemon-lifecycle](daemon-lifecycle/README.md)
- [http](http/README.md)
- [logging](logging/README.md)
- [paths](paths/README.md)
- [process-supervisor](process-supervisor/README.md)
- [push-channel](push-channel/README.md)
- [rpc-correlation](rpc-correlation/README.md)
- [service](service/README.md)
- [session-identity](session-identity/README.md)
- [storage](storage/README.md)
- [supervisor](supervisor/README.md)
- [unix-peer-cred](unix-peer-cred/README.md)
- [unix-rpc-server](unix-rpc-server/README.md)
- [vault](vault/README.md)
- [vehicle-approval-authority](vehicle-approval-authority/README.md)
- [vehicle-http-provider](vehicle-http-provider/README.md)
- [vehicle-job-persistence](vehicle-job-persistence/README.md)
- [vehicle-job-store](vehicle-job-store/README.md)
- [vehicle-registry](vehicle-registry/README.md)
- [vehicle-schedule-persistence](vehicle-schedule-persistence/README.md)
- [vehicle-scheduler](vehicle-scheduler/README.md)
- [vehicle-watchers](vehicle-watchers/README.md)
- [version](version/README.md)
