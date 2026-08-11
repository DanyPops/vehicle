/**
 * A persistent context widget projected by one Vehicle (Pi's own "above the editor" TUI slot --
 * Tasks, Notes, Jobs, ...) must name its own owner, not just what it's showing: once more than
 * one Vehicle registers a widget there, a bare "Tasks · pipes" header is indistinguishable from
 * any other extension's own widget. Wraps malevich-tui-components' formatWidgetHeader (the pure
 * "Owner · Label[ · detail...]" join) with the one Vehicle-specific step every caller would
 * otherwise duplicate: turning a manifest's own lowercase identity name ("papyrus", "pipes")
 * into its display form ("Papyrus", "Pipes"). One shared helper here, called from every Vehicle's
 * own pi-* extension, keeps that convention consistent without each extension hand-rolling its
 * own template literal.
 */
import { formatWidgetHeader } from "malevich-tui-components";

/** "papyrus" -> "Papyrus". Matches vehicle-pi-primitives.ts's own displayLabel() word-capitalization
 * convention for operation labels -- deliberately not exported from there since displayLabel splits
 * on every non-alphanumeric run (multi-word), while a Vehicle's own manifest identity name is always
 * one bare word and needs only its first letter capitalized. */
export function vehicleWidgetOwner(vehicleName: string): string {
	return vehicleName.length === 0 ? vehicleName : vehicleName.charAt(0).toUpperCase() + vehicleName.slice(1);
}

/**
 * One persistent widget header line, e.g. `vehicleWidgetTitle("papyrus", "Tasks", "pipes")` ->
 * "Papyrus · Tasks · pipes", or `vehicleWidgetTitle("pipes", "Jobs", "1 subscribed")` -> "Pipes ·
 * Jobs · 1 subscribed". `vehicleName` is the Vehicle's own manifest identity name (the same
 * string its VehicleRegistry was constructed with), not a display string -- capitalization is
 * this function's job, not the caller's.
 */
export function vehicleWidgetTitle(vehicleName: string, label: string, ...detail: readonly string[]): string {
	return formatWidgetHeader(vehicleWidgetOwner(vehicleName), label, ...detail);
}
