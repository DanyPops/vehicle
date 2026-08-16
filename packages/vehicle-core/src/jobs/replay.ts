import type { VehicleJobWakeEntry } from "./wake-log.js";

/** Read-only replay side of a wake log -- both a live VehicleJobWakeLog and a restored (no-longer-appendable) job satisfy this with the same tail() semantics. */
export interface VehicleJobWakeLogReader {
	since(cursor: number): readonly VehicleJobWakeEntry[];
	readonly cursor: number;
}

/** Wraps a fixed, already-finalized list of entries (e.g. restored from disk) in the same reader shape a live VehicleJobWakeLog exposes, so VehicleJobStore.tail() doesn't need to special-case a restored job. */
export function createStaticVehicleJobWakeLog(entries: readonly VehicleJobWakeEntry[]): VehicleJobWakeLogReader {
	const sorted = [...entries].sort((a, b) => a.seq - b.seq);
	const cursor = sorted.length > 0 ? sorted[sorted.length - 1]!.seq : 0;
	return {
		since: (cursorArg) => sorted.filter((entry) => entry.seq > cursorArg),
		cursor,
	};
}
