[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-widget-state](../README.md) / ReloadSafeWidgetState

# Interface: ReloadSafeWidgetState\<T\>

Defined in: [packages/vehicle-client-pi/src/vehicle-widget-state.ts:51](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-widget-state.ts#L51)

## Type Parameters

### T

`T`

## Methods

### load()

> **load**(`sessionManager`): `Promise`\<`T` \| `undefined`\>

Defined in: [packages/vehicle-client-pi/src/vehicle-widget-state.ts:68](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-widget-state.ts#L68)

Reads the sidecar first (canonical). Falls back to replaying the most
recent matching custom entry from the session's own branch when the
sidecar is missing or corrupt. Returns undefined when neither source
has anything, or the only available entry was itself a truncated
pointer (nothing real left to recover).

#### Parameters

##### sessionManager

[`SessionBranchReader`](SessionBranchReader.md)

#### Returns

`Promise`\<`T` \| `undefined`\>

***

### save()

> **save**(`pi`, `state`): `Promise`\<`boolean`\>

Defined in: [packages/vehicle-client-pi/src/vehicle-widget-state.ts:60](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-widget-state.ts#L60)

Persists `state` to the sidecar file (always, in full) and appends a
best-effort, fingerprint-deduped custom entry to the session branch
(truncated to a pointer past maxEntryBytes). Never throws -- a failed
write here must never break the widget interaction that triggered it;
callers that need to know a save failed should check the resolved
boolean rather than wrapping this in their own try/catch.

#### Parameters

##### pi

`ExtensionAPI`

##### state

`T`

#### Returns

`Promise`\<`boolean`\>
