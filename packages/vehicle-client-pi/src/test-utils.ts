/**
 * Test-only resets for this package's own process-wide singletons -- the shared Vehicle Shell
 * handle (vehicle-shell.ts's ensureVehicleShellHandle) and the in-process vehicle registry
 * (vehicle-shell-registry.ts), both deliberately `globalThis[Symbol.for(...)]`-keyed so every
 * registerVehicleTools() call in a process shares them regardless of which physical copy of this
 * package loaded them.
 *
 * That's also exactly why a CONSUMER's own test suite needs this subpath, not just this package's
 * own: `bun test` (and most other runners) runs every test file in one process, so without a reset
 * between tests, the first test to call registerVehicleTools()/registerPipesVehicle()/etc. creates
 * the shared handle once, and every later test in the same run silently reuses that first test's
 * own fake `pi` -- never seeing tools_list/tools_man registered on its own, freshly-constructed
 * fake `pi` at all. Call both of these in a `beforeEach` (or `afterEach`) anywhere a test exercises
 * shell mode.
 *
 * Deliberately a raw-source subpath (not part of the main compiled entry point) -- these are for a
 * consumer's own test files to import, never for production code.
 */

export { __resetVehicleShellHandleForTests } from "./vehicle-shell.js";
export { __resetInProcessVehicleRegistryForTests } from "./vehicle-shell-registry.js";
