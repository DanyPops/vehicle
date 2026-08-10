[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [vehicle-registry](../README.md) / VehicleApprovalPolicyOptions

# Interface: VehicleApprovalPolicyOptions

Defined in: [packages/vehicle-server/src/vehicle-registry.ts:265](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-registry.ts#L265)

## Properties

### authority?

> `readonly` `optional` **authority?**: `VehicleApprovalAuthority`

Defined in: [packages/vehicle-server/src/vehicle-registry.ts:269](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-registry.ts#L269)

Defaults to a fresh HmacApprovalAuthority with a random per-instance secret.

***

### requireApprovalForEffects?

> `readonly` `optional` **requireApprovalForEffects?**: readonly `VehicleEffect`[]

Defined in: [packages/vehicle-server/src/vehicle-registry.ts:267](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-registry.ts#L267)

Defaults to DEFAULT_APPROVAL_EFFECTS ([destructive, open-world]) -- the same set vehicle-client-pi historically hardcoded client-side.

***

### timeoutMs?

> `readonly` `optional` **timeoutMs?**: `number`

Defined in: [packages/vehicle-server/src/vehicle-registry.ts:271](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/vehicle-registry.ts#L271)

How long a request stays resolvable before it lapses and must be re-requested. Defaults to DEFAULT_APPROVAL_TIMEOUT_MS.
