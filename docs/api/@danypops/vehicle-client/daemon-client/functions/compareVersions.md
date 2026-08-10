[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client](../../README.md) / [daemon-client](../README.md) / compareVersions

# Function: compareVersions()

> **compareVersions**(`a`, `b`): `number`

Defined in: [packages/vehicle-client/src/daemon-client.ts:488](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/daemon-client.ts#L488)

Dependency-free dotted-numeric version comparator (no semver package -- this file
deliberately has no imports of its own, see the module doc comment). Compares segments
numerically ("0.44.12" < "0.45.0"); a non-numeric segment on either side falls back to a
plain string comparison of that segment, which is still deterministic, just not
semver-aware (pre-release tags, build metadata). Missing trailing segments compare as 0
("1.2" === "1.2.0"). Returns negative/zero/positive like Array.prototype.sort's comparator.

## Parameters

### a

`string`

### b

`string`

## Returns

`number`
