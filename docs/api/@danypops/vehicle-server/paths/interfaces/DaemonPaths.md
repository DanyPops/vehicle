[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [paths](../README.md) / DaemonPaths

# Interface: DaemonPaths

Defined in: [packages/vehicle-server/src/paths.ts:29](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/paths.ts#L29)

## Properties

### database

> **database**: `string`

Defined in: [packages/vehicle-server/src/paths.ts:31](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/paths.ts#L31)

Linux: XDG_DATA_HOME/<name>/<databaseFilename>. macOS: ~/Library/Application Support/<name>/<databaseFilename>. Windows: %LOCALAPPDATA%\<name>\Data\<databaseFilename>.

***

### handle

> **handle**: `string`

Defined in: [packages/vehicle-server/src/paths.ts:35](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/paths.ts#L35)

Linux: XDG_RUNTIME_DIR/<name>/<handleFilename>. macOS/Windows: under the OS temp directory -- see the module doc comment for why this is a weaker guarantee than XDG_RUNTIME_DIR there.

***

### serviceDescriptor

> **serviceDescriptor**: `string`

Defined in: [packages/vehicle-server/src/paths.ts:43](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/paths.ts#L43)

Platform-neutral location for this daemon's optional persistence
descriptor: a systemd --user unit on Linux; a launchd plist or Windows
Registry Run value elsewhere. This module only resolves a directory --
generating and installing the actual per-platform descriptor is the
cross-platform service-install work, not this one.

***

### token

> **token**: `string`

Defined in: [packages/vehicle-server/src/paths.ts:33](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/paths.ts#L33)

Linux: XDG_STATE_HOME/<name>/<tokenFilename>. macOS/Windows: alongside `database` -- neither platform has a distinct "state" convention separate from app data.
