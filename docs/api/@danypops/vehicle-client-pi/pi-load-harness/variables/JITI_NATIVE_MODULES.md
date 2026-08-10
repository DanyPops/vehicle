[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [pi-load-harness](../README.md) / JITI\_NATIVE\_MODULES

# Variable: JITI\_NATIVE\_MODULES

> `const` **JITI\_NATIVE\_MODULES**: `string`[]

Defined in: node\_modules/.bun/@danypops+pi-extension-harness@0.6.2+55c4f66afaa2c118/node\_modules/@danypops/pi-extension-harness/dist/jiti-native-modules.d.ts:13

Pure-CJS packages whose module-level Maps must live in the global V8 realm,
not jiti's transform scope -- loading them through jiti's transform instead
of natively produces a real, silent bug class: a Map/Set constructed inside
the transformed module is a *different* Map/Set constructor than the one
`instanceof` checks elsewhere in the process use, so cross-realm lookups
silently fail instead of throwing.

Vendored from pi's own extension loader (core/extensions/loader.ts) -- not
exported publicly by @earendil-works/pi-coding-agent as of this writing, so
this list is kept in sync manually. Small and stable in practice.
