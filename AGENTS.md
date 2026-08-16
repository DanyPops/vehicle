# Development Rules

Vehicle is the shared substrate every other daemon/Pi-extension pair in this ecosystem
(papyrus, tickets, pipes, web-spider, packed, jittor, ...) is built on:
`vehicle-core` (the operation/schema/effect/idempotency contract), `vehicle-server`
(`VehicleRegistry`, the HTTP transport, daemon lifecycle), `vehicle-client` (a plain
`VehicleClient`), `vehicle-client-pi` (projects a `VehicleClient`'s manifest into Pi tools),
and `armada` (native service supervision). A bug fixed here, or a primitive extracted here
instead of re-derived per consumer, benefits every daemon in the ecosystem at once -- that
duplication-avoidance is this repo's whole reason to exist.

## Conversational Style

- Keep answers short and concise; technical prose only.
- When the user asks a question, answer it first before making edits.
- No narrative/incident lore in permanent code comments -- "previously", "used to", "confirmed
  live", "discovered live" retellings belong in a commit message, not a docblock a future reader
  re-scans every time they touch the function. A comment documents current behavior + why, not a
  changelog entry that silently rots the moment "previously" stops being true.

## Code Quality

- Read a file in full before a wide-ranging change to it, or before auditing it -- don't rely on
  grep snippets for broad edits.
- No `any` unless truly unavoidable; when unavoidable (e.g. a generic wire-boundary cast),
  narrow it with one justified `eslint-disable` comment at the exact line, not a blanket rule
  suppression.
- Every extensibility point (a `Map`/`Set` a caller can register into, e.g. approval requests,
  event listeners, execution middlewares) needs an explicit capacity bound -- see
  `MAX_PENDING_APPROVALS`, `MAX_LISTENERS_PER_EVENT`, `MAX_EXECUTION_MIDDLEWARES` for the
  existing pattern to match.
- A new consumer-facing capability that isn't a wholesale swap of an existing single-slot
  API (e.g. adding a second policy hook) should be additive/backward-compatible by default --
  see `VehicleRegistry.useExecutionMiddleware()` coexisting with `setExecutionPolicy()`.

## Commands

- Per-package: `bun run typecheck`, `bun test` (or `sh -c 'bun test'` when verifying a fix that's
  specifically about nested-subprocess signal/process-group behavior -- see
  `vehicle-server/test/graceful-shutdown.test.ts`'s own history for why that distinction matters).
- Whole workspace: `bun run typecheck` (root script rebuilds every package first, since
  cross-package `import` resolution in this repo goes through built `dist/`, not source), `bun
  test` (root), `bun run lint` (`biome lint . && eslint packages --max-warnings 0`), `bun run
  policy` (`packed-policy`, also run in CI).
- After any code change: run that package's typecheck + test, then the whole-workspace
  typecheck/lint before considering the change done. A change to `vehicle-core`/`vehicle-server`
  in particular can silently break every downstream package that imports it -- check
  `bun run --filter '*' typecheck` at the workspace root, not just the package you touched.
- `unset VEHICLE_SHELL_DISABLED;` before a gate/test command that exercises Vehicle Shell mode --
  a stray env var left set in one shell session otherwise silently forces every
  `registerVehicleTools()` call in that process to skip shell mode.

## Testing

- A test that spawns a real subprocess and sends it a real signal (SIGTERM, etc.) needs the
  signal handler registered *before* any external observer (a log line, a readiness check) can
  act on it -- see `restartable-unit.ts`'s own fix: register-then-log, never log-then-register.
  A test passing standalone but failing nested inside a gate-runner subprocess is a real race,
  not "flaky infra" -- reproduce it under artificial CPU contention (a few busy-loop background
  processes) before concluding it can't be fixed.
- A test suite failure that doesn't reproduce on a clean re-run, especially cross-file and only
  under a full multi-package `bun test`, is genuinely a different category (order/pollution
  flakiness) from a deterministic one -- document it as a separate, explicitly non-deterministic
  finding rather than bundling it into a fix for the deterministic issue next to it.

## Multi-Repo Dependency Discipline

- `dependency` vs `peerDependency` for `vehicle-client-pi` (and similar shared-runtime packages)
  matters: a consumer holding shared mutable module-level state (registries, singleton
  `Symbol.for()` slots) needs exactly one copy in the process -- `peerDependency` forces that;
  a plain `dependency` lets bun silently nest a second, version-drifted copy. Verify via source
  inspection which packages actually hold shared state before migrating a dependency's kind.
- Before assuming a consumer's tests exercise current source: confirm the workspace package's
  own declared floor (`^0.x.y`) actually covers the sibling's current local version. A stale
  floor is not just a missed bump -- bun silently resolves a stale *published* copy instead of
  linking the local workspace source, and every test in that consumer since then ran against
  the wrong code. `bun install` then confirm `node_modules/@danypops/<pkg>` is a real symlink
  into the sibling's own directory, not `.bun/@danypops+<pkg>@<old-version>`.
- `Symbol.for(key)` returns the same Symbol across every separately-loaded copy of a module in
  one process; a `globalThis` + `Symbol.for()` shared slot defends against duplicate module
  instances but not against version-shape drift between them -- version-suffix the key.

## Git & Releases

- Never commit an `edit`/`write` in the same tool call as a commit -- edits land, then verify
  (typecheck/test/lint), then commit.
- Per-package release: bump `package.json` version (PATCH for a backward-compatible addition;
  check whether a MINOR bump would break an existing consumer's caret range before choosing it),
  run the full local typecheck+test+lint, commit, push the commit, then tag
  (`<package>-v<version>`, see `.github/workflows/publish.yml`'s own tag list for exact package
  names) and push **each tag separately** -- pushing multiple tags in one `git push` can silently
  suppress GitHub Actions workflow dispatch for all but one of them.
- `scripts/check-release-discipline.mjs` runs in `publish.yml` and blocks a release that widens
  a package's public API surface without a version bump reflecting it -- read its own doc
  comments before assuming a flagged diff is a false positive; extend its detection logic when a
  legitimate architectural change is genuinely blocked by an overly narrow rule, rather than
  bypassing the check.
- After pushing tags: watch CI to completion (`pipes:ci.wait`/`ci_subscribe` with the exact
  registered backend name), then verify the version landed on npm (`npm view <pkg> version`) --
  a green CI run and a live npm publish are two separate facts, confirm both.

## Task Tracking

- This repo's work (and every consumer's Vehicle-adoption work) is tracked in the shared Papyrus
  task database. Use `tasks.start` → implement → `tasks.set_gates` (a real command a reviewer
  could re-run, e.g. `bun run typecheck && bun test <file>`) → `tasks.submit` → `tasks.complete`.
  A gate should prove the actual fix, not just "the package still builds" -- e.g. the nested
  `sh -c 'bun test'` gate on the graceful-shutdown fix is itself the exact failing scenario the
  task was filed against.
- Splitting one cross-repo finding into per-project child tasks (one child task per repo
  actually touched) keeps each repo's own gate/commit/task-lifecycle scoped to that repo's real
  change, instead of one task spanning commits in 4 different git histories.

## User Override

If the user's instructions conflict with any rule in this document, ask for explicit
confirmation before overriding. Only then execute their instructions.
