/**
 * Vehicle Jobs run as in-process promises, not child processes -- there is
 * no PID to reuse, but a persisted job record written by one process
 * instance must still never be mistaken for one this (possibly restarted)
 * instance can still resolve. Each VehicleJobStore construction gets a
 * fresh random instanceToken; a persisted record's own stamped token only
 * ever matches the instance that wrote it. A mismatch means "the original
 * run is gone" -- this instance should treat the record as orphaned rather
 * than resolve it.
 */
export function vehicleJobIdentityMatches(recordInstanceToken: string, currentInstanceToken: string): boolean {
	return recordInstanceToken === currentInstanceToken;
}
