/**
 * A process-wide "does the shared shell handle's registration need to be redone" flag, set by
 * bootstrap.ts's own session_shutdown listener and consumed by ensureVehicleShellHandle -- see
 * that function's own doc comment for the real incident this exists to fix (Vehicle Shell's
 * meta-tools silently vanishing after a `/reload`) and why this is a dedicated session_shutdown
 * signal rather than a pi.getAllTools() presence probe (which races against real multi-extension
 * load order).
 *
 * `globalThis[Symbol.for(...)]`, not a module-level variable, for the same reason every other
 * Vehicle Shell singleton uses it: several separately-installed npm copies of this file (one per
 * vehicle) must all observe the SAME flag, and Symbol.for()+globalThis are process-wide while a
 * plain module-level binding is scoped to whichever physical copy happens to import it.
 */
const NEEDS_REREGISTRATION_KEY = Symbol.for("vehicle.shell.needs-reregistration@1");

function holder(): { [NEEDS_REREGISTRATION_KEY]?: boolean } {
	return globalThis as { [NEEDS_REREGISTRATION_KEY]?: boolean };
}

/** Arms the flag -- called from a session_shutdown listener, Pi's own authoritative "this
 * extension instance's registrations are about to be torn down" signal. */
export function markVehicleShellNeedsReregistration(): void {
	holder()[NEEDS_REREGISTRATION_KEY] = true;
}

/** Reads and clears the flag in one step: the caller that observes `true` is about to actually
 * re-register, so a second, unrelated caller in the same batch shouldn't redundantly see it too. */
export function vehicleShellNeedsReregistration(): boolean {
	const needsReregistration = holder()[NEEDS_REREGISTRATION_KEY] === true;
	if (needsReregistration) holder()[NEEDS_REREGISTRATION_KEY] = false;
	return needsReregistration;
}

/** Test-only: resets the flag so each test starts clean. Not exported from the package's own
 * public entry point. */
export function __resetVehicleShellReregistrationFlagForTests(): void {
	delete holder()[NEEDS_REREGISTRATION_KEY];
}
