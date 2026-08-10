[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-widget-state](../README.md) / ReloadSafeWidgetStateOptions

# Interface: ReloadSafeWidgetStateOptions

Defined in: [packages/vehicle-client-pi/src/vehicle-widget-state.ts:41](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-widget-state.ts#L41)

## Properties

### filePath

> `readonly` **filePath**: `string`

Defined in: [packages/vehicle-client-pi/src/vehicle-widget-state.ts:45](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-widget-state.ts#L45)

Where the sidecar file lives. Callers own path resolution (e.g. via daemonStateDir()) -- this helper has no opinion on directory layout.

***

### fs

> `readonly` **fs**: `AtomicJsonFsAdapter`

Defined in: [packages/vehicle-client-pi/src/vehicle-widget-state.ts:46](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-widget-state.ts#L46)

***

### key

> `readonly` **key**: `string`

Defined in: [packages/vehicle-client-pi/src/vehicle-widget-state.ts:43](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-widget-state.ts#L43)

Unique per widget -- becomes both the session custom entry's customType and the sidecar file's own identity. Pick something namespaced, e.g. "papyrus.task-overlay".

***

### maxEntryBytes?

> `readonly` `optional` **maxEntryBytes?**: `number`

Defined in: [packages/vehicle-client-pi/src/vehicle-widget-state.ts:48](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-widget-state.ts#L48)

Hard bound on the session-branch copy's own serialized size. The sidecar file itself is never bounded by this. Defaults to 64KB, matching vstack's own BG_TASKS_SNAPSHOT_MAX_BYTES precedent.
