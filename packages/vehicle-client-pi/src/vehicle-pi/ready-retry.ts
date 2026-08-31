/**
 * registerVehicleToolsWhenReady -- resolves a daemon target/client and retries the whole
 * resolve+register sequence with bounded backoff, logging every outcome instead of the silent
 * failure every consumer independently reimplemented before this existed. Split out of
 * vehicle-pi.ts's own bundled concerns (Vehicle Pass 1 SRP audit finding #5).
 */

import { performance } from "node:perf_hooks";
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

export interface VehicleReadyTimingEvent {
	readonly phase: "client-resolution" | "registration" | "retry-delay" | "total";
	readonly outcome: "available" | "unavailable" | "failed" | "registered" | "slept" | "exhausted";
	readonly attempt?: number;
	readonly attempts: number;
	readonly durationMs: number;
	readonly ctx: ExtensionContext;
}

export interface RegisterVehicleToolsWhenReadyOptions extends RegisterVehicleToolsOptions {
	/** Every resolution/registration outcome, success or failure -- see VehicleReadyEvent. Omitting this restores today's silent behavior; a caller wanting the fix should always supply one (e.g. ctx.ui.notify or a structured logger). */
	readonly log?: (event: VehicleReadyEvent) => void;
	/** Monotonic phase durations for startup profiling. Callback failures are isolated exactly like log failures. */
	readonly onTiming?: (event: VehicleReadyTimingEvent) => void;
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
 * multi-attempt backoff). Session shutdown cancels pending retries before
 * their captured API and context become stale. The returned promise settles
 * once registration succeeds, retries exhaust, or the owning session shuts
 * down -- awaiting it is optional and mainly useful for tests.
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
	let settled = false;
	let sessionGeneration = 0;
	const done = new Promise<RegisteredPiVehicle | undefined>((resolve) => {
		settle = resolve;
	});
	const settleOnce = (value: RegisteredPiVehicle | undefined): void => {
		if (settled) return;
		settled = true;
		settle(value);
	};
	const isCurrentSession = (generation: number): boolean => generation === sessionGeneration;

	// Observer failures are contained so diagnostics cannot disrupt registration or host lifetime.
	function safeLog(event: VehicleReadyEvent): void {
		try {
			options.log?.(event);
		} catch (error) {
			console.error(`registerVehicleToolsWhenReady: log callback threw for a "${event.kind}" event -- ${error}`);
		}
	}

	function safeTiming(event: VehicleReadyTimingEvent): void {
		try {
			options.onTiming?.(event);
		} catch (error) {
			console.error(`registerVehicleToolsWhenReady: timing callback threw for a "${event.phase}" event -- ${error}`);
		}
	}

	async function attempt(attemptNumber: number, ctx: ExtensionContext, totalStartedAt: number, generation: number): Promise<void> {
		if (!isCurrentSession(generation)) return;
		let client: Parameters<typeof deps.registerVehicleTools>[1] | undefined;
		let resolutionFailed = false;
		const resolutionStartedAt = performance.now();
		try {
			client = await resolveClient();
			if (!isCurrentSession(generation)) return;
			safeTiming({
				phase: "client-resolution",
				outcome: client ? "available" : "unavailable",
				attempt: attemptNumber,
				attempts,
				durationMs: Math.max(0, performance.now() - resolutionStartedAt),
				ctx,
			});
		} catch (error) {
			if (!isCurrentSession(generation)) return;
			safeTiming({
				phase: "client-resolution",
				outcome: "failed",
				attempt: attemptNumber,
				attempts,
				durationMs: Math.max(0, performance.now() - resolutionStartedAt),
				ctx,
			});
			safeLog({ kind: "client-resolution-failed", attempt: attemptNumber, attempts, error, ctx });
			resolutionFailed = true;
		}

		if (client) {
			const registrationStartedAt = performance.now();
			try {
				const registered = await deps.registerVehicleTools(pi, client, options);
				if (!isCurrentSession(generation)) return;
				safeTiming({
					phase: "registration",
					outcome: "registered",
					attempt: attemptNumber,
					attempts,
					durationMs: Math.max(0, performance.now() - registrationStartedAt),
					ctx,
				});
				safeTiming({
					phase: "total",
					outcome: "registered",
					attempt: attemptNumber,
					attempts,
					durationMs: Math.max(0, performance.now() - totalStartedAt),
					ctx,
				});
				safeLog({ kind: "registered", attempt: attemptNumber, ctx });
				settleOnce(registered);
				return;
			} catch (error) {
				if (!isCurrentSession(generation)) return;
				safeTiming({
					phase: "registration",
					outcome: "failed",
					attempt: attemptNumber,
					attempts,
					durationMs: Math.max(0, performance.now() - registrationStartedAt),
					ctx,
				});
				safeLog({ kind: "registration-failed", attempt: attemptNumber, attempts, error, ctx });
			}
		} else if (!resolutionFailed) {
			safeLog({ kind: "client-unavailable", attempt: attemptNumber, attempts, ctx });
		}

		if (attemptNumber >= attempts) {
			safeTiming({
				phase: "total",
				outcome: "exhausted",
				attempt: attemptNumber,
				attempts,
				durationMs: Math.max(0, performance.now() - totalStartedAt),
				ctx,
			});
			safeLog({ kind: "exhausted", attempts, ctx });
			settleOnce(undefined);
			return;
		}
		const delayStartedAt = performance.now();
		await sleep(readyRetryDelayMs(attemptNumber, options.retry));
		if (!isCurrentSession(generation)) return;
		safeTiming({
			phase: "retry-delay",
			outcome: "slept",
			attempt: attemptNumber,
			attempts,
			durationMs: Math.max(0, performance.now() - delayStartedAt),
			ctx,
		});
		await attempt(attemptNumber + 1, ctx, totalStartedAt, generation);
	}

	pi.on("session_start", (_event, ctx) => {
		const generation = ++sessionGeneration;
		void attempt(1, ctx, performance.now(), generation);
	});
	pi.on("session_shutdown", () => {
		sessionGeneration++;
		settleOnce(undefined);
	});

	return done;
}
