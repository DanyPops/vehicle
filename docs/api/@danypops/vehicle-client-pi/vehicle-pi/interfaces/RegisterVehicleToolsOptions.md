[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-pi](../README.md) / RegisterVehicleToolsOptions

# Interface: RegisterVehicleToolsOptions

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:136](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L136)

## Extended by

- [`RegisterVehicleToolsWhenReadyOptions`](RegisterVehicleToolsWhenReadyOptions.md)

## Properties

### approvalPresentation?

> `readonly` `optional` **approvalPresentation?**: [`PiHitlPresentation`](../../hitl-prompt/type-aliases/PiHitlPresentation.md)

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:219](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L219)

Host used for local approval HITL. `overlay` (default) blocks in a popup over
scrollback; `integrated` replaces Pi's editor while preserving its draft,
scrollback, and footer. RPC/headless contexts retain the native confirm fallback.

***

### closeClientOnSessionShutdown?

> `readonly` `optional` **closeClientOnSessionShutdown?**: `boolean`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:151](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L151)

***

### executionMode?

> `readonly` `optional` **executionMode?**: (`descriptor`) => `ToolExecutionMode` \| `undefined`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:196](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L196)

Per-operation override for Pi's own tool-call concurrency semantics --
e.g. "sequential" for an operation whose interactiveFollowUps prompts a
human synchronously, so the model can't batch it alongside other tool
calls and let those run before the human sees the prompt. Undefined (the
default for every operation) means Pi's own default concurrency mode,
unchanged from today.

#### Parameters

##### descriptor

`VehicleOperationDescriptor`

#### Returns

`ToolExecutionMode` \| `undefined`

***

### handshake?

> `readonly` `optional` **handshake?**: [`RegisterVehicleToolsHandshakeOptions`](RegisterVehicleToolsHandshakeOptions.md)

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:250](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L250)

Bounded retry/backoff around the initial manifest handshake -- the real-world gap this
closes: a Pi extension's session_start calls registerVehicleTools() exactly once, and a
daemon that is transiently unreachable at that exact moment (mid-restart from a
legitimate version-check kill/respawn, or a package update swapping files out from under
a live process) previously meant every Vehicle-projected tool was silently, permanently
missing for the rest of that session -- no reload required to trigger it, and no reload
could fix it either, since the next session_start would just race the same restart again
if it was still in progress. Modeled on connectPushChannel's own jittered exponential
backoff (min/max/growFactor, +/-20% jitter) and gRPC/Kubernetes-style bounded readiness
probing: retry a few times over roughly half a second, then give up -- long enough to
survive a real restart (observed ~100-300ms in production), short enough that a
genuinely-down daemon still fails fast. Defaults to attempts:4, initialDelayMs:50,
maxDelayMs:500, growFactor:2.5. Set attempts:1 to restore the old immediate-failure
behavior exactly.

***

### interactiveFollowUps?

> `readonly` `optional` **interactiveFollowUps?**: (`descriptor`) => [`PiVehicleInteractiveFollowUp`](../type-aliases/PiVehicleInteractiveFollowUp.md) \| `undefined`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:187](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L187)

Per-operation escape hatch for a client-local interactive step after a
successful invoke() -- see PiVehicleInteractiveFollowUp. Returning
undefined (or omitting this option, or the resolver itself returning
undefined for a given descriptor) means every operation behaves exactly
as before this option existed: default content/details from the
primary output, no extra round trip.

#### Parameters

##### descriptor

`VehicleOperationDescriptor`

#### Returns

[`PiVehicleInteractiveFollowUp`](../type-aliases/PiVehicleInteractiveFollowUp.md) \| `undefined`

***

### manifestCache?

> `readonly` `optional` **manifestCache?**: `object`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:233](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L233)

Survives a restart/reload while the daemon is unreachable: a successful
manifest() fetch is persisted here (atomic write, best-effort -- a failed
write never fails registration); a failed factory-time fetch falls back
to reading this file instead of throwing, so tool definitions and their
renderers still exist for transcript replay of a historical tool call
even while offline. Live availability (available/permissions) still only
ever comes from a real manifest -- see RegisteredPiVehicle.stale and
refreshVehicleToolAvailability, which callers should still wire to
session_start (e.g. via registerVehicleStatusRefresh) to reconcile once
the daemon is reachable again. Omitted (the default) preserves today's
behavior: a factory-time manifest() failure throws.

#### filePath

> `readonly` **filePath**: `string`

#### fs

> `readonly` **fs**: `AtomicJsonFsAdapter`

***

### modelContentMaxBytes?

> `readonly` `optional` **modelContentMaxBytes?**: `number`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:176](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L176)

Independent UTF-8 transcript budget. Defaults to 16 KiB; unrelated to transport and presentation-detail bounds.

***

### onInvoked?

> `readonly` `optional` **onInvoked?**: (`request`, `output`) => `void` \| `Promise`\<`void`\>

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:149](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L149)

Fires after a successful invoke(), before the tool result is returned -- for a
consumer-local side effect the operation's own output has no way to carry (e.g. a
same-process Pi extension event bus notification a sibling extension observes; a
remote HTTP Vehicle consumer has no such bus, so this is deliberately host-local,
not part of the operation's own transport-neutral contract). Never aborts the tool
call: an error here is swallowed, matching the same "best-effort broadcast" contract
a direct pi.events.emit() call would carry on its own.

#### Parameters

##### request

[`PiVehicleInvocationRequest`](PiVehicleInvocationRequest.md)

##### output

`unknown`

#### Returns

`void` \| `Promise`\<`void`\>

***

### permissions?

> `readonly` `optional` **permissions?**: readonly `string`[]

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:137](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L137)

***

### presentations?

> `readonly` `optional` **presentations?**: (`descriptor`) => [`PiVehiclePresentationContract`](PiVehiclePresentationContract.md) \| `undefined`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:174](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L174)

Paired custom pre-persistence projector + renderer. Projection failures fail closed after the
application invocation has succeeded: raw output is never substituted into persisted details.
Omit this for the bounded generic vehicle.tool-details/v1 projector/renderer pair.

#### Parameters

##### descriptor

`VehicleOperationDescriptor`

#### Returns

[`PiVehiclePresentationContract`](PiVehiclePresentationContract.md) \| `undefined`

***

### principal?

> `readonly` `optional` **principal?**: `VehiclePrincipal`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:138](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L138)

***

### progressBarGlyphs?

> `readonly` `optional` **progressBarGlyphs?**: `ProgressGlyphs` \| `ProgressGlyphStyle`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:178](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L178)

Human-selected glyph strategy for the generic renderer's progress bars. Geometry/math is unchanged.

***

### renderers?

> `readonly` `optional` **renderers?**: (`descriptor`) => [`VehicleToolRenderers`](VehicleToolRenderers.md) \| `undefined`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:168](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L168)

Per-operation renderCall/renderResult override. Returning undefined (or
omitting this option entirely) falls back to the generic Vehicle
renderer, which renders effect-colored call rows and a Table/ProgressBar/
collapsible-JSON result view driven by the operation's own descriptor --
see vehicle-render.ts. A consumer with real UX investment in one
operation supplies its own pair here; every other operation still gets
sensible default rendering instead of Pi's raw-JSON fallback.

This is the HUMAN TUI channel only. The model-facing channel is a
separate concern: see extractVehicleContent in vehicle-core -- an
operation whose output carries its own `content` blocks gets those sent
to the model instead of raw JSON, with no per-registration option needed
here at all, since the operation itself is the only code that knows how
to narrate what it computed.

#### Parameters

##### descriptor

`VehicleOperationDescriptor`

#### Returns

[`VehicleToolRenderers`](VehicleToolRenderers.md) \| `undefined`

***

### requireApprovalForEffects?

> `readonly` `optional` **requireApprovalForEffects?**: readonly `VehicleEffect`[]

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:204](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L204)

Mirrors the server's own VehicleRegistry.configureApprovals()
requireApprovalForEffects set (see vehicle-server) so /safety's "ask"
classification matches reality -- purely advisory here: the server
enforces its own copy regardless of what this option says. Defaults to
DEFAULT_APPROVAL_EFFECTS, the same default the server itself uses.

***

### resolveInvocation?

> `readonly` `optional` **resolveInvocation?**: [`PiVehicleInvocationResolver`](../type-aliases/PiVehicleInvocationResolver.md)

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:139](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L139)

***

### safetyPolicyStore?

> `readonly` `optional` **safetyPolicyStore?**: [`VehicleSafetyPolicyStore`](../../vehicle-safety/classes/VehicleSafetyPolicyStore.md)

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:213](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L213)

A human's own /safety overrides, consulted ahead of the effect-level
default and the permission-based check for both tool visibility (see
syncManagedActiveTools below) and the local pre-invoke approval gate
(see createTool's execute()). Omitted means no overrides exist --
classification falls back to permissions+effect exactly as before this
option existed, a zero-behavior-change default.

***

### shell?

> `readonly` `optional` **shell?**: `VehicleShellOptions`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:260](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L260)

Opt-in Vehicle Shell activation: instead of activating every available, permitted operation
(this option's own default omission), registers two always-on meta-tools (tools_list,
tools_man by default) and keeps most operations inactive behind a decaying-TTL cache -- see
vehicle-shell.ts. Exists because a Vehicle with dozens of operations otherwise puts every
single one's full schema in context from turn one, regardless of whether the session ever
calls it. Omitted (the default) preserves today's all-active behavior exactly, for every
existing consumer that hasn't opted in.

***

### toolName?

> `readonly` `optional` **toolName?**: (`descriptor`, `versioned`) => `string`

Defined in: [packages/vehicle-client-pi/src/vehicle-pi.ts:150](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-pi.ts#L150)

#### Parameters

##### descriptor

`VehicleOperationDescriptor`

##### versioned

`boolean`

#### Returns

`string`
