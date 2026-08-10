[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [daemon](../README.md) / LAUNCH\_PROVENANCE\_ENV\_VAR

# Variable: LAUNCH\_PROVENANCE\_ENV\_VAR

> `const` **LAUNCH\_PROVENANCE\_ENV\_VAR**: `"DAEMON_KIT_LAUNCH_PROVENANCE"` = `"DAEMON_KIT_LAUNCH_PROVENANCE"`

Defined in: [packages/vehicle-server/src/daemon.ts:110](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon.ts#L110)

Read by startDaemon() to pick a default idle-shutdown policy when the
caller doesn't set idleBudgetMs explicitly. Set by the two things that
actually start a daemon process: spawnDetachedDaemon() (pi-client.ts)
sets "auto-spawn" on a lazily-started child; the generated systemd
unit/launchd plist/Windows Run command (service.ts) sets "service". A
daemon started neither way (plain `bun cli.ts serve` during local
development) reports "unknown" and is treated the same as "auto-spawn" --
the safer default is to assume nothing should run forever unless a real
installed service said so.

Both this file and pi-client.ts/service.ts declare this same string
independently rather than importing a shared constant -- pi-client.ts is
compiled standalone with no imports of its own by design (see its module
doc comment), so it cannot depend on this module.
