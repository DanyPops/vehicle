import type { AtomicJsonFsAdapter, VehicleClient, VehicleManifest } from "@danypops/vehicle-core";
import { createAtomicJsonWriter } from "@danypops/vehicle-core";
import { sleep } from "./vehicle-pi-primitives.js";

/**
 * Manifest fetch + bounded handshake retry + optional offline-survival caching, split out of
 * vehicle-pi.ts's own kitchen-sink module. Distinct from safety classification, job polling, and
 * local approval prompting -- this is purely "how registerVehicleTools/refreshVehicleToolAvailability
 * get a real, current VehicleManifest to work from."
 */

export interface RegisterVehicleToolsHandshakeOptions {
	/** Total attempts at the initial manifest fetch, including the first. Defaults to 4. */
	readonly attempts?: number;
	/** Delay before the second attempt. Defaults to 50ms. */
	readonly initialDelayMs?: number;
	/** No retry delay is ever allowed to exceed this. Defaults to 500ms. */
	readonly maxDelayMs?: number;
	/** Multiplier applied to the delay after each failed attempt. Defaults to 2.5. */
	readonly growFactor?: number;
}

const DEFAULT_HANDSHAKE_ATTEMPTS = 4;
const DEFAULT_HANDSHAKE_INITIAL_DELAY_MS = 50;
const DEFAULT_HANDSHAKE_MAX_DELAY_MS = 500;
const DEFAULT_HANDSHAKE_GROW_FACTOR = 2.5;

/** Jittered exponential backoff, same shape as connectPushChannel's own reconnect delay (vehicle-client/daemon-client.ts): +/-20% jitter prevents several concurrent Pi sessions from retrying a just-restarted daemon in lockstep. */
function handshakeRetryDelayMs(attemptJustFailed: number, options: RegisterVehicleToolsHandshakeOptions | undefined): number {
	const initialDelayMs = options?.initialDelayMs ?? DEFAULT_HANDSHAKE_INITIAL_DELAY_MS;
	const maxDelayMs = options?.maxDelayMs ?? DEFAULT_HANDSHAKE_MAX_DELAY_MS;
	const growFactor = options?.growFactor ?? DEFAULT_HANDSHAKE_GROW_FACTOR;
	const raw = Math.min(initialDelayMs * growFactor ** (attemptJustFailed - 1), maxDelayMs);
	return raw * (0.8 + Math.random() * 0.4);
}

/**
 * Retries client.manifest() itself, bounded, before resolveManifestForRegistration ever falls
 * back to a stale cache or rethrows -- see RegisterVehicleToolsOptions.handshake for why this
 * exists. A transient failure (the daemon mid-restart) recovers here without ever touching the
 * cache-fallback/throw path below; only a failure that outlasts every attempt reaches it.
 */
async function fetchManifestWithHandshakeRetry(
	client: VehicleClient,
	handshake: RegisterVehicleToolsHandshakeOptions | undefined,
): Promise<VehicleManifest> {
	const attempts = Math.max(1, handshake?.attempts ?? DEFAULT_HANDSHAKE_ATTEMPTS);
	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			return await client.manifest();
		} catch (error) {
			if (attempt === attempts) throw error;
			await sleep(handshakeRetryDelayMs(attempt, handshake));
		}
	}
	// Unreachable: the loop above always either returns or throws on its final attempt.
	throw new Error("fetchManifestWithHandshakeRetry: exhausted attempts without a terminal result");
}

/**
 * A live client.manifest() call is the source of truth whenever it succeeds --
 * on success, best-effort persists it to manifestCache for next time
 * (a failed cache write never fails registration). On failure, falls back to
 * the cached manifest if one exists (marking the result stale); with no cache
 * configured, or nothing cached yet, rethrows the original failure unchanged --
 * identical to registerVehicleTools' behavior before manifestCache existed.
 */
export async function resolveManifestForRegistration(
	client: VehicleClient,
	manifestCache: { readonly filePath: string; readonly fs: AtomicJsonFsAdapter } | undefined,
	handshake: RegisterVehicleToolsHandshakeOptions | undefined,
): Promise<{ manifest: VehicleManifest; stale: boolean }> {
	try {
		const manifest = await fetchManifestWithHandshakeRetry(client, handshake);
		if (manifestCache) {
			try {
				await createAtomicJsonWriter({ fs: manifestCache.fs }).write(manifestCache.filePath, manifest);
			} catch {
				// Best-effort: a failed cache write must never fail a successful registration/refresh.
			}
		}
		return { manifest, stale: false };
	} catch (error) {
		if (!manifestCache) throw error;
		let cached: unknown;
		try {
			cached = await createAtomicJsonWriter({ fs: manifestCache.fs }).read(manifestCache.filePath);
		} catch {
			cached = undefined;
		}
		if (cached === undefined) throw error;
		return { manifest: cached as VehicleManifest, stale: true };
	}
}

/** Best-effort cache refresh after a real live fetch -- never used to mask a failed live fetch (refreshVehicleToolAvailability's whole point is verifying against the daemon, so it keeps throwing on failure, matching its behavior before manifestCache existed; pi-status-refresh's own safeRefresh already tolerates that). */
export async function persistManifestCache(
	manifestCache: { readonly filePath: string; readonly fs: AtomicJsonFsAdapter } | undefined,
	manifest: VehicleManifest,
): Promise<void> {
	if (!manifestCache) return;
	try {
		await createAtomicJsonWriter({ fs: manifestCache.fs }).write(manifestCache.filePath, manifest);
	} catch {
		// Best-effort: a failed cache write must never fail a successful refresh.
	}
}
