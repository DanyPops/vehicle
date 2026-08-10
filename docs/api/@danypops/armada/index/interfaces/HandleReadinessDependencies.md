[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/armada](../../README.md) / [index](../README.md) / HandleReadinessDependencies

# Interface: HandleReadinessDependencies

Defined in: [fleet/readiness.ts:14](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/fleet/readiness.ts#L14)

## Properties

### isPidAlive?

> `readonly` `optional` **isPidAlive?**: (`pid`) => `boolean`

Defined in: [fleet/readiness.ts:16](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/fleet/readiness.ts#L16)

#### Parameters

##### pid

`number`

#### Returns

`boolean`

***

### now?

> `readonly` `optional` **now?**: () => `number`

Defined in: [fleet/readiness.ts:17](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/fleet/readiness.ts#L17)

#### Returns

`number`

***

### readHandle?

> `readonly` `optional` **readHandle?**: (`path`) => `Promise`\<`unknown`\>

Defined in: [fleet/readiness.ts:15](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/fleet/readiness.ts#L15)

#### Parameters

##### path

`string`

#### Returns

`Promise`\<`unknown`\>

***

### sleep?

> `readonly` `optional` **sleep?**: (`milliseconds`) => `Promise`\<`void`\>

Defined in: [fleet/readiness.ts:18](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/armada/src/fleet/readiness.ts#L18)

#### Parameters

##### milliseconds

`number`

#### Returns

`Promise`\<`void`\>
