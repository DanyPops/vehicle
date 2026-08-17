# @danypops/vehicle-client-pi

Projects any `VehicleClient` into native Pi tools -- exact operation
versions, schemas, cancellation, Pi call/session identity, permissions,
keyed idempotency, progress, structured failures, and live tool-visibility
curation by operation availability.

Every projected tool also gets real `renderCall`/`renderResult` rendering
by default, driven by the operation's own descriptor metadata (`effect`,
name) rather than Pi's generic JSON dump: an effect-colored call row, a
table for array-of-object results, a progress bar for a mid-flight partial
result, and collapsible JSON otherwise -- built on
[`malevich-tui-components`](https://www.npmjs.com/package/malevich-tui-components).
Generic results are projected once, before persistence, into the strict,
versioned `vehicle.tool-details/v1` DTO. It has independent serialized-detail,
row, column, field-text, and preview-text bounds; expanded mode can reveal only
rows already in that DTO. A consumer with real UX investment in one operation
supplies a paired `presentations(descriptor)` contract: its required
`projector.maxBytes` and `project()` produce JSON-safe persisted details, and
its `renderResult` parses that exact DTO. Projection errors fail closed after
the application invocation has succeeded; raw output is never silently
persisted as a fallback. The older `renderers` option remains a compatibility
path and retains legacy `{ vehicle, output }` details until that renderer is
migrated. The human can select the generic bar's
block language through the host extension: pass `progressBarGlyphs: "shade" |
"smooth" | "blocks" | "ascii"` (or a custom Malevich glyph set) to
`registerVehicleTools`; progress geometry and transport data are unchanged.
Call `registerVehicleTools()` from an async extension factory so Pi has those renderers before replaying persisted
tool rows. Runtime-dependent availability synchronization is deferred to
`session_start` automatically.

That rendering is the human TUI channel only. What the model itself reads
is separate: an operation's output defaults to bounded formatted JSON, but an
operation whose result is meant to be read as a narrative (a workflow run's
summary, a gate report) can include its own `content: [{ type: "text",
text }]` field -- the same field name and shape MCP's `CallToolResult` and
Pi's own tool-result type already use -- and that gets sent to the model
instead. `modelContentMaxBytes` defaults to 16 KiB of UTF-8 text, independently
of the operation transport limit and presentation-details limit. ANSI is
removed; truncation ends with deterministic omitted-byte/`complete=false`
metadata. Continue with a domain cursor/job/read operation rather than asking
the renderer to reveal unpersisted output. See `extractVehicleContent`/
`WithVehicleContent` in `@danypops/vehicle-core`.

Progress uses the same bounded generic DTO for transient updates. An
interactive follow-up's replacement output is what gets projected, while its
model `content` is bounded independently. Replay strictly parses v1; malformed
or newer presentation details fall back to useful model content without
throwing. Historical `{ vehicle, output }` rows still use the legacy renderer
compatibility path.

Generic call rendering consults each operation's input JSON Schema recursively.
`writeOnly: true`, `format: "password"`, and credential-shaped field names are
always omitted. Use `x-vehicle-presentation: "omit"` for another sensitive or
noisy field, or `"summarize"` to show only shape/size without its value.

A consumer-local side effect the operation's own output can't carry --
e.g. broadcasting on a same-process Pi extension event bus so a sibling
extension can react -- has its own hook: `registerVehicleTools(pi, client,
{ onInvoked })` fires after a successful `invoke()`, before the tool
result is returned. It's deliberately host-local, not part of the
operation's transport-neutral contract (a remote HTTP Vehicle consumer has
no such bus), and never aborts the tool call: an error thrown from
`onInvoked` is swallowed, the same "best-effort broadcast" contract a
direct `pi.events.emit()` call would carry on its own.

Every invocation failure is sanitized into a structured `VehicleFailure` before it
reaches Pi (`sanitizedFailure()`), classifying `VehicleError`, a Vehicle-client
transport error, or a raw transport-level throw. That classification is itself
instrumented (`./client-diagnostics`): if it ever fails internally (its own
name for this: `vehicle-client-classification-failed`), the failure is
reported on the `vehicle-client-pi:classification-failure`
[`node:diagnostics_channel`](https://nodejs.org/api/diagnostics_channel.html)
(subscribe directly for a real observability pipeline; zero cost with no
subscriber) and, when `VEHICLE_CLIENT_DIAG=1`, appended as a JSONL line to
`~/.cache/vehicle/client-diag.log` (override with `VEHICLE_CLIENT_DIAG_PATH`)
for interactive debugging of one live session -- never the original error's
own message/stack, only its constructor name.

The Vehicle Shell's own meta-tools (`tools_list`/`tools_man`/`tools_type`,
`./vehicle-shell`) report their own calls into whichever vehicle daemon(s)
are relevant, via the real `metrics.recordClientEvent` operation every
vehicle wired up with `@danypops/vehicle-server`'s own metrics support
exposes -- these three tools are pure in-process aggregation over cached
manifests and never themselves reach a daemon's `invoke()` path otherwise,
so this is the one place client-observed shell usage becomes visible
server-side. `tools_man`/`tools_type` report once per distinct vehicle a
call actually resolved a name against; `tools_list` (no single target
vehicle -- a global browse) broadcasts to every currently-discovered
vehicle. Fire-and-forget and best-effort throughout (see
`./vehicle-shell`'s own `usage-reporting.ts`): a reporting failure, or an
older daemon with no `metrics.recordClientEvent` operation at all, never
affects a real tool call's own result. Deliberately no client-side storage
of any kind.

The same package carries the rest of this house's Pi-extension-facing
surface: `./pi-load-harness` (jiti-load-safety verification for any
Pi-loaded module), `./multi-select-list` (Malevich's bounded multi-select
state and viewport bound to Pi's theme, ANSI-aware text measurement, and
semantic keymap), `./pi-status-refresh` (`registerVehicleStatusRefresh` --
refresh a footer/widget on `session_start` and again whenever one of this
extension's own projected tools just ran, tolerating a daemon that isn't up
yet), and the shared `/secrets` Pi command (`./secrets-backend`,
`./secrets-backend-env`, `./secrets-backend-local`, `./secrets-registry`,
`./secrets-tui`) that several extensions in one Pi session merge into.

```bash
bun add @danypops/vehicle-client-pi
```

See the [workspace README](https://github.com/DanyPops/vehicle#readme) for
`registerVehicleTools()`/`refreshVehicleToolAvailability()` usage and the full
Vehicle package layout.
