[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/armada](../../README.md) / [index](../README.md) / ReconcileRequest

# Interface: ReconcileRequest

Defined in: [fleet/reconciler.ts:17](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/fleet/reconciler.ts#L17)

## Properties

### controller

> `readonly` **controller**: [`NativeServiceController`](NativeServiceController.md)

Defined in: [fleet/reconciler.ts:21](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/fleet/reconciler.ts#L21)

***

### manifest

> `readonly` **manifest**: [`ArmadaManifest`](ArmadaManifest.md)

Defined in: [fleet/reconciler.ts:18](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/fleet/reconciler.ts#L18)

***

### plan

> `readonly` **plan**: [`FleetPlan`](FleetPlan.md)

Defined in: [fleet/reconciler.ts:19](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/fleet/reconciler.ts#L19)

***

### readCurrentManifestHash

> `readonly` **readCurrentManifestHash**: () => `Promise`\<[`ManifestHashReadOutcome`](../type-aliases/ManifestHashReadOutcome.md)\>

Defined in: [fleet/reconciler.ts:22](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/fleet/reconciler.ts#L22)

#### Returns

`Promise`\<[`ManifestHashReadOutcome`](../type-aliases/ManifestHashReadOutcome.md)\>

***

### readiness

> `readonly` **readiness**: [`ReadinessProbe`](ReadinessProbe.md)

Defined in: [fleet/reconciler.ts:23](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/fleet/reconciler.ts#L23)

***

### strategy

> `readonly` **strategy**: [`NativeServiceStrategy`](NativeServiceStrategy.md)

Defined in: [fleet/reconciler.ts:20](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/fleet/reconciler.ts#L20)
