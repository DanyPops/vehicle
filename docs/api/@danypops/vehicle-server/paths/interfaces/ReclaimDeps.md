[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [paths](../README.md) / ReclaimDeps

# Interface: ReclaimDeps

Defined in: [packages/vehicle-server/src/paths.ts:294](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/paths.ts#L294)

## Properties

### graceMs?

> `optional` **graceMs?**: `number`

Defined in: [packages/vehicle-server/src/paths.ts:300](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/paths.ts#L300)

Total time budget for each of the SIGTERM and (if needed) SIGKILL waits. Defaults to 5s -- this is a loopback RPC server with no long-running work to flush, closer to nginx's fast-shutdown posture than a stateful job's.

***

### isPidAlive?

> `optional` **isPidAlive?**: (`pid`) => `boolean`

Defined in: [packages/vehicle-server/src/paths.ts:295](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/paths.ts#L295)

#### Parameters

##### pid

`number`

#### Returns

`boolean`

***

### kill?

> `optional` **kill?**: (`pid`, `signal`) => `void`

Defined in: [packages/vehicle-server/src/paths.ts:296](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/paths.ts#L296)

#### Parameters

##### pid

`number`

##### signal

`Signals`

#### Returns

`void`

***

### log?

> `optional` **log?**: (`event`) => `void`

Defined in: [packages/vehicle-server/src/paths.ts:303](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/paths.ts#L303)

One record per decision, not just per kill -- a skipped reap needs to be exactly as visible as an executed one.

#### Parameters

##### event

[`ReclaimLogEvent`](ReclaimLogEvent.md)

#### Returns

`void`

***

### pollIntervalMs?

> `optional` **pollIntervalMs?**: `number`

Defined in: [packages/vehicle-server/src/paths.ts:301](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/paths.ts#L301)

***

### sleep?

> `optional` **sleep?**: (`ms`) => `Promise`\<`void`\>

Defined in: [packages/vehicle-server/src/paths.ts:298](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/paths.ts#L298)

Called between liveness polls while waiting out the grace period. Defaults to a real setTimeout-backed delay; tests inject a no-delay version so the grace period costs no real wall-clock time.

#### Parameters

##### ms

`number`

#### Returns

`Promise`\<`void`\>
