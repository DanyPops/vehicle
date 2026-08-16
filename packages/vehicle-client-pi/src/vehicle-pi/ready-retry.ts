/**
 * registerVehicleToolsWhenReady -- resolves a daemon target/client and retries the whole
 * resolve+register sequence with bounded backoff, logging every outcome instead of the silent
 * failure every consumer independently reimplemented before this existed. Split out of
 * vehicle-pi.ts's own bundled concerns (Vehicle Pass 1 SRP audit finding #5).
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { RegisteredPiVehicle, RegisterVehicleToolsOptions, registerVehicleTools } from "../vehicle-pi.js";
import { sleep } from "../vehicle-pi-primitives.js";

/**
 * One attempt's outcome, reported through `log` instead of the silent
 * return/bare-catch every consumer independently reimplemented (pi-tickets'
 * registerTicketsVehicle, pi-papyrus's registerNotesVehicle): `resolveClient`
 * returning undefined (no daemon target resolvable yet), `resolveClient`
 * throwing, or `registerVehicleTools` itself throwing all previously
 * vanished with zero diagnostic trail. `attempt`/`attempts` are 1-based and
 * inclusive, e.g. "2 of 5".
 */
export type VehicleReadyEvent =
	| { readonly kind: "client-unavailable"; readonly attempt: number; readonly attempts: number; readonly ctx: ExtensionContext }
	| {
			readonly kind: "client-resolution-failed";
			readonly attempt: number;
			readonly attempts: number;
			readonly error: unknown;
			readonly ctx: ExtensionContext;
	  }
	| {
			readonly kind: "registration-failed";
			readonly attempt: number;
			readonly attempts: number;
			readonly error: unknown;
			readonly ctx: ExtensionContext;
	  }
	| { readonly kind: "registered"; readonly attempt: number; readonly ctx: ExtensionContext }
	| { readonly kind: "exhausted"; readonly attempts: number; readonly ctx: ExtensionContext };

export interface VehicleReadyRetryOptions {
	/** Total attempts across the whole resolve+register sequence, including the first. Defaults to 6. */
	readonly attempts?: number;
	/** Delay before the second attempt. Defaults to 250ms. */
	readonly initialDelayMs?: number;
	/** No retry delay is ever allowed to exceed this. Defaults to 5000ms. */
	readonly maxDelayMs?: number;
	/** Multiplier applied to the delay after each failed attempt. Defaults to 2. */
	readonly growFactor?: number;
}

export interface RegisterVehicleToolsWhenReadyOptions extends RegisterVehicleToolsOptions {
	/** Every resolution/registration outcome, success or failure -- see VehicleReadyEvent. Omitting this restores today's silent behavior; a caller wanting the fix should always supply one (e.g. ctx.ui.notify or a structured logger). */
	readonly log?: (event: VehicleReadyEvent) => void;
	readonly retry?: VehicleReadyRetryOptions;
}

const DEFAULT_READY_RETRY_ATTEMPTS = 6;
const DEFAULT_READY_INITIAL_DELAY_MS = 250;
const DEFAULT_READY_MAX_DELAY_MS = 5_000;
const DEFAULT_READY_GROW_FACTOR = 2;

/** Same jittered exponential-backoff shape as handshakeRetryDelayMs, sized for the coarser-grained problem this solves: a daemon that hasn't started at all yet (seconds), not a manifest call mid-flight (milliseconds). */
function readyRetryDelayMs(attemptJustFailed: number, retry: VehicleReadyRetryOptions | undefined): number {
	const initialDelayMs = retry?.initialDelayMs ?? DEFAULT_READY_INITIAL_DELAY_MS;
	const maxDelayMs = retry?.maxDelayMs ?? DEFAULT_READY_MAX_DELAY_MS;
	const growFactor = retry?.growFactor ?? DEFAULT_READY_GROW_FACTOR;
	const raw = Math.min(initialDelayMs * growFactor ** (attemptJustFailed - 1), maxDelayMs);
	return raw * (0.8 + Math.random() * 0.4);
}

/** The one real (non-type) coupling this module has back to vehicle-pi.ts -- injected rather
 * than imported directly, to avoid a real import cycle. */
export interface ReadyRetryDeps {
	readonly registerVehicleTools: typeof registerVehicleTools;
}

/**
 * Wraps `registerVehicleTools` with the one step it never owned: resolving
 * the daemon target and building a client in the first place. That step is
 * inherently consumer-specific (each daemon has its own handle file/target
 * resolution), which is why it was never centralized here before -- but the
 * failure handling around it (silent return on no target, bare catch on any
 * error, no later retry) was reimplemented identically by every consumer
 * and always dropped the failure on the floor. This centralizes that
 * handling once: every step logs through `log` instead of vanishing, and a
 * daemon that is merely slow to start gets bounded retries (see
 * VehicleReadyRetryOptions) instead of a permanent zero-tools outcome for
 * the rest of the session.
 *
 * Registers one `session_start` handler that kicks off the resolve+register
 * sequence in the background (never blocks session_start itself on a
 * multi-attempt backoff) and returns a promise that settles once the
 * sequence either succeeds or exhausts its attempts -- awaiting it is
 * optional, useful mainly for tests and for a caller that wants to know the
 * final outcome (e.g. to show one status line) without polling.
 *
 * Every other `RegisterVehicleToolsOptions` field (including the opt-in
 * `shell` activation mode) passes straight through to the eventual
 * `registerVehicleTools` call unchanged.
 */
export function registerVehicleToolsWhenReady(
	deps: ReadyRetryDeps,
	pi: ExtensionAPI,
	resolveClient: () => Promise<Parameters<typeof deps.registerVehicleTools>[1] | undefined>,
	options: RegisterVehicleToolsWhenReadyOptions = {},
): Promise<RegisteredPiVehicle | undefined> {
	const attempts = Math.max(1, options.retry?.attempts ?? DEFAULT_READY_RETRY_ATTEMPTS);
	let settle!: (value: RegisteredPiVehicle | undefined) => void;
	const done = new Promise<RegisteredPiVehicle | undefined>((resolve) => {
		settle = resolve;
	});

	// `attempt` reuses one ctx captured at session_start across every retry, including across the
	// sleep between attempts -- a session replaced or reloaded during that window leaves `ctx`
	// stale (see extensions.md's "Session replacement lifecycle and footguns"), and a caller's own
	// `log` reading e.g. event.ctx.ui then throws. `attempt` itself runs fire-and-forget (see the
	// `void attempt(1, ctx)` call below), so any exception escaping `log` would otherwise surface
	// as an unhandled rejection that kills the whole host process, not just this one registration
	// attempt. safeLog swallows that failure so a broken/now-stale log callback can never do that,
	// and so every terminal branch still reaches its own settle() call.
	function safeLog(event: VehicleReadyEvent): void {
		try {
			options.log?.(event);
		} catch (error) {
			console.error(`registerVehicleToolsWhenReady: log callback threw for a "${event.kind}" event -- ${error}`);
		}
	}

	async function attempt(attemptNumber: number, ctx: ExtensionContext): Promise<void> {
		let client: Parameters<typeof deps.registerVehicleTools>[1] | undefined;
		let resolutionFailed = false;
		try {
			client = await resolveClient();
		} catch (error) {
			safeLog({ kind: "client-resolution-failed", attempt: attemptNumber, attempts, error, ctx });
			resolutionFailed = true;
		}

		if (client) {
			try {
				const registered = await deps.registerVehicleTools(pi, client, options);
				safeLog({ kind: "registered", attempt: attemptNumber, ctx });
				settle(registered);
				return;
			} catch (error) {
				safeLog({ kind: "registration-failed", attempt: attemptNumber, attempts, error, ctx });
			}
		} else if (!resolutionFailed) {
			safeLog({ kind: "client-unavailable", attempt: attemptNumber, attempts, ctx });
		}

		if (attemptNumber >= attempts) {
			safeLog({ kind: "exhausted", attempts, ctx });
			settle(undefined);
			return;
		}
		await sleep(readyRetryDelayMs(attemptNumber, options.retry));
		await attempt(attemptNumber + 1, ctx);
	}

	pi.on("session_start", (_event, ctx) => {
		void attempt(1, ctx);
	});

	return done;
}
