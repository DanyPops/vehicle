# @danypops/vehicle-conformance

Host-neutral `bun:test` conformance suite for any `VehicleClient`
implementation -- one shared assertion set that a `LocalVehicleClient`, a
`RemoteVehicleClient`, or any future transport must satisfy identically.
Ships raw TypeScript; a test-time devDependency, not a runtime library.

```bash
bun add -d @danypops/vehicle-conformance
```

```ts
import {
  registerConformanceOperations,
  runVehicleClientConformance,
  runToolShellDualChannelConformance,
} from "@danypops/vehicle-conformance";
```

`runToolShellDualChannelConformance(fixture)` is the host-neutral Tool Shell
matrix. A fixture adapts one provider's real projection/rendering boundary via
`execute`, `render`, `replay`, `renderCall`, and `invalidProjection`; the shared
suite checks independent model/presentation sentinels and named bounds,
JSON-safe secret-free details, malformed/unknown replay fallback, collapsed vs.
expanded immutability, schema-sensitive call rendering, 40/80/120-column
physical-line safety, partial output, and projector exception policy. Pi-specific
component construction stays in the adapter fixture rather than this package.

## The five boundaries

Every conformant Tool Shell provider keeps five things independent:

1. **Application DTO** -- the domain's own real output shape, transport-neutral,
   untouched by any presentation concern.
2. **Model content** -- what the LLM reads: independently bounded, ANSI-free,
   semantic. Never derived from or coupled to what a human sees.
3. **Persisted presentation details** -- a *projected*, versioned, discriminated-union
   DTO, independently bounded, with explicit `{total, returned, omitted}`
   completeness metadata. Projected once, before persistence -- never inferred
   from raw output at render time.
4. **Interactive component** -- the rendered view of #3. Expanded mode may only
   reveal rows already inside the bounded DTO, never bypass the bound by
   reaching back into raw application output.
5. **CLI presenters** -- a separate, JSON/human-text presentation path outside
   the interactive TUI entirely; out of scope for this suite.

The fail-closed rule that matters most: a parser for #3 must reject a
malformed/unknown-version/oversized/cyclic details object and fall back to
**content** (#2) -- never render raw, unbounded application output as a human
view.

## Declared-value coverage

A fixture's `ToolShellDualChannelSubject` can optionally supply
`declaredValueCases` (one `{ value, rawPayload }` per value of a discriminator
field the provider's own schema declares -- a `format`/`kind`/`action`/...) plus
a matching `renderDeclaredValue(value, rawPayload, options)`. When present, the
suite renders one result per declared value and fails if fewer than
`min(2, cases.length)` of them escape being textually indistinguishable from a
raw `JSON.stringify(rawPayload, null, 2)` dump.

This is the generic version of a `never`-typed exhaustiveness guard on a
discriminated switch -- it catches the same bug class (most declared values
silently falling through to an undifferentiated raw-JSON view) in bespoke
non-switch code too (an `if`-chain, a plain-string `action` switch with no
compile-time exhaustiveness), which a TypeScript-only lint rule would miss
entirely. `evaluateDeclaredValueCoverage(cases, renderDeclaredValue, options)`
is exported separately for direct unit testing of the classifier against a
known-bad fixture shape, independent of the wrapping `bun:test` assertion.

Omit `declaredValueCases` entirely for a subject with no such discriminator --
the check then no-ops.

See the [workspace README](https://github.com/DanyPops/vehicle#readme) for
the full Vehicle package layout.
