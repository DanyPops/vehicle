/**
 * A structural marker a Pi registration (tool/command/shortcut/flag) can carry to self-declare
 * "multiple extensions calling this exact registration helper land on the SAME shared name by
 * design, not by accidental collision" -- see secrets-registry.ts's own claimSecretsCommandName
 * and vehicle-shell/bootstrap.ts's own claimedElsewhere for the two existing "claim once,
 * everyone else merges in" implementations of this pattern.
 *
 * Pi's own ExtensionAPI.registerTool/registerCommand accept a sealed parameter type with no room
 * for extra fields. markSharedRegistration widens through a non-literal expression -- excess
 * property checking only applies to a fresh object literal at the call site, never to a value
 * already flowing through a typed function -- so the extra `shared: true` field survives at
 * runtime without a type error, while Pi's real runtime harmlessly ignores an unknown property on
 * a registration options object it never reads by name.
 *
 * The one consumer of this signal today is pi-packed's own doctor smoke harness: Pi's real
 * multi-extension process only ever calls the ACTUAL pi.registerX once per shared name (this
 * repo's own claim-once helpers ensure that), but a smoke-tested extension always runs alone in
 * its own fresh sandbox, so every claimant looks like "the first, and only, one" from inside its
 * own isolated scan -- doctor.run would otherwise flag the shared name as a genuine collision.
 * There is no shared TypeScript type across repos for this; the consumer reads the field by its
 * exact literal name, `shared`, off the definition/options object a registration call was made
 * with.
 */
export function markSharedRegistration<T extends object>(definition: T): T & { shared: true } {
	return { ...definition, shared: true };
}
