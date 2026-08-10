[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-widget-state](../README.md) / SessionBranchReader

# Interface: SessionBranchReader

Defined in: [packages/vehicle-client-pi/src/vehicle-widget-state.ts:35](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-widget-state.ts#L35)

ReadonlySessionManager itself isn't exported from the package root (only
used internally to type ExtensionContext.sessionManager) -- this minimal
structural interface is the one real method load() needs, so a caller can
pass ctx.sessionManager directly without this file importing an
unexported type.

## Methods

### getBranch()

> **getBranch**(`fromId?`): `SessionEntry`[]

Defined in: [packages/vehicle-client-pi/src/vehicle-widget-state.ts:36](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-widget-state.ts#L36)

#### Parameters

##### fromId?

`string`

#### Returns

`SessionEntry`[]
