[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [daemon](../README.md) / RunningDaemon

# Interface: RunningDaemon

Defined in: [packages/vehicle-server/src/daemon.ts:81](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon.ts#L81)

## Properties

### host

> **host**: `string`

Defined in: [packages/vehicle-server/src/daemon.ts:82](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon.ts#L82)

***

### idleBudgetMs

> **idleBudgetMs**: `number`

Defined in: [packages/vehicle-server/src/daemon.ts:87](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon.ts#L87)

The idle-shutdown budget actually in effect (0 means disabled) -- exposed so a caller/test can observe the provenance-derived default without waiting it out.

***

### instanceId

> **instanceId**: `string`

Defined in: [packages/vehicle-server/src/daemon.ts:85](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon.ts#L85)

Minted once at startup (see daemon-lifecycle.ts) -- present regardless of whether lifecycleLog was supplied, since it's cheap and useful identity even without logging.

***

### port

> **port**: `number`

Defined in: [packages/vehicle-server/src/daemon.ts:83](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon.ts#L83)

***

### stopped

> **stopped**: `Promise`\<`void`\>

Defined in: [packages/vehicle-server/src/daemon.ts:91](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon.ts#L91)

Resolves once stop() has fully run, however it was triggered (an explicit call, or the internal idle timer) -- the single signal runDaemonProcess needs to exit the process for either case.

## Methods

### stop()

> **stop**(`reason?`): `Promise`\<`void`\>

Defined in: [packages/vehicle-server/src/daemon.ts:89](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon.ts#L89)

reason (e.g. "SIGTERM") is recorded to lifecycleLog when supplied; omitted defaults to "explicit". Purely additive over the prior zero-arg signature -- every existing caller keeps working unchanged.

#### Parameters

##### reason?

`string`

#### Returns

`Promise`\<`void`\>
