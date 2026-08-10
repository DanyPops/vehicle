[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [daemon](../README.md) / RunDaemonProcessOptions

# Interface: RunDaemonProcessOptions

Defined in: [packages/vehicle-server/src/daemon.ts:432](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon.ts#L432)

## Extends

- [`StartDaemonOptions`](StartDaemonOptions.md)

## Properties

### buildApp

> **buildApp**: () => `object`

Defined in: [packages/vehicle-server/src/daemon.ts:135](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon.ts#L135)

#### Returns

`object`

##### fetch()

> **fetch**(`request`): `Promise`\<`Response`\>

###### Parameters

###### request

`Request`

###### Returns

`Promise`\<`Response`\>

#### Inherited from

[`StartDaemonOptions`](StartDaemonOptions.md).[`buildApp`](StartDaemonOptions.md#buildapp)

***

### daemonLabel

> **daemonLabel**: `string`

Defined in: [packages/vehicle-server/src/daemon.ts:129](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon.ts#L129)

e.g. "Web Spider" -- used only in the bind-failure error message.

#### Inherited from

[`StartDaemonOptions`](StartDaemonOptions.md).[`daemonLabel`](StartDaemonOptions.md#daemonlabel)

***

### env?

> `optional` **env?**: `Record`\<`string`, `string` \| `undefined`\>

Defined in: [packages/vehicle-server/src/daemon.ts:148](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon.ts#L148)

Defaults to process.env. Injectable for tests.

#### Inherited from

[`StartDaemonOptions`](StartDaemonOptions.md).[`env`](StartDaemonOptions.md#env)

***

### handleMode?

> `optional` **handleMode?**: `number`

Defined in: [packages/vehicle-server/src/daemon.ts:132](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon.ts#L132)

Defaults to 0600 (owner-only), correct for a same-user daemon and consumer. Pass 0644 for a daemon meant to be discovered across OS users -- the handle's own content (host/port/pid) is never sensitive. See writeDaemonHandle.

#### Inherited from

[`StartDaemonOptions`](StartDaemonOptions.md).[`handleMode`](StartDaemonOptions.md#handlemode)

***

### handlePath

> **handlePath**: `string`

Defined in: [packages/vehicle-server/src/daemon.ts:130](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon.ts#L130)

#### Inherited from

[`StartDaemonOptions`](StartDaemonOptions.md).[`handlePath`](StartDaemonOptions.md#handlepath)

***

### idleBudgetMs?

> `optional` **idleBudgetMs?**: `number`

Defined in: [packages/vehicle-server/src/daemon.ts:144](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon.ts#L144)

Explicit override always wins. When omitted, the default is chosen from
LAUNCH_PROVENANCE_ENV_VAR: "service" gets no idle shutdown (0, always-on);
"auto-spawn" or "unknown" get DEFAULT_AUTO_SPAWN_IDLE_BUDGET_MS.

#### Inherited from

[`StartDaemonOptions`](StartDaemonOptions.md).[`idleBudgetMs`](StartDaemonOptions.md#idlebudgetms)

***

### idleTickMs?

> `optional` **idleTickMs?**: `number`

Defined in: [packages/vehicle-server/src/daemon.ts:145](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon.ts#L145)

#### Inherited from

[`StartDaemonOptions`](StartDaemonOptions.md).[`idleTickMs`](StartDaemonOptions.md#idletickms)

***

### lifecycleLog?

> `optional` **lifecycleLog?**: [`DaemonLifecycleLog`](../../daemon-lifecycle/interfaces/DaemonLifecycleLog.md)

Defined in: [packages/vehicle-server/src/daemon.ts:170](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon.ts#L170)

Opt-in structured lifecycle event log (see daemon-lifecycle.ts) -- when supplied, startDaemon
records "started"/"already_running"/"stopped" events against it. Omitted by default so every
existing caller is unaffected; a consumer wanting a `<daemon> diagnose` command supplies one
backed by openDaemonLifecycleLog(). Recording failures are logged and swallowed -- a lifecycle
log must never be why a daemon fails to start or stop.

#### Inherited from

[`StartDaemonOptions`](StartDaemonOptions.md).[`lifecycleLog`](StartDaemonOptions.md#lifecyclelog)

***

### lockPath?

> `optional` **lockPath?**: `string`

Defined in: [packages/vehicle-server/src/daemon.ts:134](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon.ts#L134)

Defaults to a `daemon.lock` file beside handlePath. Override only if that would collide with another daemon's own state.

#### Inherited from

[`StartDaemonOptions`](StartDaemonOptions.md).[`lockPath`](StartDaemonOptions.md#lockpath)

***

### lockReclaim?

> `optional` **lockReclaim?**: [`ReclaimDeps`](../../paths/interfaces/ReclaimDeps.md)

Defined in: [packages/vehicle-server/src/daemon.ts:162](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon.ts#L162)

Overrides for the lock-reclaim behavior that only activates when this daemon's own
launch provenance is "service" (see LAUNCH_PROVENANCE_ENV_VAR) and the current lock
holder is not -- an ad hoc auto-spawned process (or a pre-migration lock file with no
recorded provenance) has no standing to block a supervised restart. Real defaults
(process.kill, a real setTimeout-backed sleep, a 5s grace period) apply when omitted;
tests inject fakes to exercise the race without spawning real processes or waiting
real wall-clock time. See paths.ts's acquireDaemonLockAsService.

#### Inherited from

[`StartDaemonOptions`](StartDaemonOptions.md).[`lockReclaim`](StartDaemonOptions.md#lockreclaim)

***

### logger?

> `optional` **logger?**: [`Logger`](../../logging/interfaces/Logger.md)

Defined in: [packages/vehicle-server/src/daemon.ts:137](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon.ts#L137)

Defaults to a no-op logger; maintenance-task failures are otherwise silently lost, which was a real gap in two of the four original daemons.

#### Inherited from

[`StartDaemonOptions`](StartDaemonOptions.md).[`logger`](StartDaemonOptions.md#logger)

***

### maintenanceTasks?

> `optional` **maintenanceTasks?**: [`MaintenanceTask`](MaintenanceTask.md)[]

Defined in: [packages/vehicle-server/src/daemon.ts:138](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon.ts#L138)

#### Inherited from

[`StartDaemonOptions`](StartDaemonOptions.md).[`maintenanceTasks`](StartDaemonOptions.md#maintenancetasks)

***

### onListen?

> `optional` **onListen?**: (`info`) => `void`

Defined in: [packages/vehicle-server/src/daemon.ts:433](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon.ts#L433)

#### Parameters

##### info

###### host

`string`

###### port

`number`

#### Returns

`void`

***

### onShutdown?

> `optional` **onShutdown?**: () => `void` \| `Promise`\<`void`\>

Defined in: [packages/vehicle-server/src/daemon.ts:146](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon.ts#L146)

#### Returns

`void` \| `Promise`\<`void`\>

#### Inherited from

[`StartDaemonOptions`](StartDaemonOptions.md).[`onShutdown`](StartDaemonOptions.md#onshutdown)

***

### pushChannel?

> `optional` **pushChannel?**: [`PushChannel`](../../push-channel/classes/PushChannel.md)

Defined in: [packages/vehicle-server/src/daemon.ts:150](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon.ts#L150)

Optional WebSocket push-invalidation channel (see push-channel.ts). Additive to the fetch-based RPC -- requests to `pushPath` are routed to it, everything else still goes to buildApp()'s fetch.

#### Inherited from

[`StartDaemonOptions`](StartDaemonOptions.md).[`pushChannel`](StartDaemonOptions.md#pushchannel)

***

### pushPath?

> `optional` **pushPath?**: `string`

Defined in: [packages/vehicle-server/src/daemon.ts:152](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/daemon.ts#L152)

Defaults to "/push".

#### Inherited from

[`StartDaemonOptions`](StartDaemonOptions.md).[`pushPath`](StartDaemonOptions.md#pushpath)
