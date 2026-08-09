/**
 * Generalizes the "lazily connect a push channel, fall back to polling,
 * retry once the daemon comes up" dance every Vehicle-backed Pi widget with
 * live-refresh has so far hand-rolled independently -- confirmed twice
 * within Papyrus alone (TaskOverlay, NoteOverlay each pair their own
 * ensurePushChannel() + BoundedPoll), on top of Lector's own two more
 * reinventions of the same "watch a changing resource" shape (see the
 * research this task is drawn from). A widget author now supplies three
 * things -- how to call the daemon's own watch(resource) operation, how to
 * resolve the current push-channel target, and what "refresh" means for
 * this widget -- and gets lazy connect, poll fallback, and connectPushChannel()'s
 * own reconnect/backoff/jitter/heartbeat resilience for free.
 *
 * Deliberately re-attempts watch() on every poll tick while disconnected,
 * mirroring subscribeTaskPushChannel's own tolerance for "the daemon hasn't
 * started yet" -- a widget's very first refresh may run before any daemon
 * handle exists on disk, and this is the natural, already-scheduled retry
 * point rather than a second timer.
 *
 * connectPushChannel() reconnects the *transport* -- a dead socket coming
 * back up -- but resubscribes the same fixed topic list it was given at
 * construction. A daemon restart invalidates the watchId (and therefore the
 * topic) a watch() call minted against the *previous* process even when the
 * socket itself reconnects cleanly, since the new process's WatchRegistry
 * starts empty. Detected here the same way a rebinding daemon is always
 * detected in this codebase: resolvePushTarget()'s own url changes on every
 * restart (a fresh random port), so a change since the current watch was
 * established means that watch is meaningless and must be replaced --
 * without waiting for the socket to visibly close first, which may never
 * happen if the new process happens to accept the same reconnect attempt.
 */
import { connectPushChannel, type PushChannelClient } from "@danypops/vehicle-client/daemon-client";

export interface VehicleWatchTarget {
	readonly watchId: string;
	readonly topic: string;
}

export interface VehiclePushTarget {
	readonly url: string;
	readonly token: string;
}

/**
 * "connecting"/"connected"/"polling" are ordinary, expected states a live widget cycles
 * through; "renewing" is also ordinary (a daemon restart or a reported-unknown watch is a
 * routine event, not a failure). "resolver-failed", "timed-out", and "canceled" are the three
 * terminal-for-push shapes a presentation must be able to distinguish so it never shows a
 * "refreshing" spinner indefinitely -- polling (if the push target still resolves at all)
 * keeps the widget's data fresh regardless of which state push itself is in.
 */
export type WatchedRefreshState = "connecting" | "connected" | "polling" | "renewing" | "resolver-failed" | "timed-out" | "canceled";

export interface WatchedRefreshOptions {
	/**
	 * Calls the daemon's own "${name}.watch" operation and returns its
	 * {watchId, topic} output. Return undefined when the daemon isn't
	 * reachable yet (mirrors subscribeTaskPushChannel's own tolerance) --
	 * the next poll tick retries automatically.
	 */
	watch: () => Promise<VehicleWatchTarget | undefined>;
	/**
	 * Best-effort release of a watch this widget no longer needs (e.g. the daemon's own
	 * "${name}.unwatch" operation, see createVehicleWatchOperations in vehicle-server) --
	 * called before replacing a stale watch. A rejection is swallowed: the daemon instance
	 * that issued the old watchId may already be gone, in which case there is nothing to
	 * release in the first place.
	 */
	unwatch?: (target: VehicleWatchTarget) => Promise<void>;
	/**
	 * Resolves the push channel's current {url, token} -- re-invoked on
	 * every reconnect attempt (a daemon rebinds a new random port on every
	 * restart). Returning undefined behaves like watch() returning
	 * undefined: push connection stays down, polling keeps this widget
	 * refreshed regardless. Its own `url` doubles as this daemon instance's
	 * identity: a change since the current watch was established forces
	 * renewal (see the file-level doc comment).
	 */
	resolvePushTarget: () => VehiclePushTarget | undefined;
	/** Does the real refresh (e.g. re-fetch and re-render). Called on every push notification for this watch's own topic, and on every poll tick regardless of push state. Thrown/rejected errors are the caller's own concern -- not swallowed here, unlike registerVehicleStatusRefresh's status-bar use case, since a widget's own refresh() already has its own established error handling (e.g. TaskOverlay's try/catch around callService). */
	refresh: () => void | Promise<void>;
	pollIntervalMs: number;
	/** Bounds a single watch() attempt -- a hung call degrades to polling and reports "resolver-failed" instead of leaving state stuck at "connecting" forever. Defaults to 5000. */
	watchTimeoutMs?: number;
	/** Caps consecutive renewal attempts (identity-changed, reported-unknown-watch, or a closed push channel) before giving up on push for the rest of this session and reporting "timed-out" -- polling continues regardless, since it never depended on push in the first place. Defaults to 5. */
	maxRenewAttempts?: number;
	/** Every state transition, in order. Optional -- a caller that doesn't need a "refreshing forever" guard can omit it with zero behavior change. */
	onStateChange?: (state: WatchedRefreshState) => void;
	/** Defaults to the global WebSocket. Injectable for tests. */
	WebSocketImpl?: typeof WebSocket;
}

export interface WatchedRefreshHandle {
	/** Stops polling and closes any open push connection. Idempotent. Reports "canceled". */
	stop(): void;
	/**
	 * Signals that the current watch is no longer valid -- e.g. the daemon's own push message
	 * or a direct RPC reported an unknown-watch condition for this topic. Forces the same
	 * single-flighted renewal an identity change triggers, without waiting for the next poll
	 * tick. A no-op while a renewal is already in flight (see maxRenewAttempts) or after stop().
	 */
	reportUnknownWatch(): void;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error) => {
				clearTimeout(timer);
				reject(error);
			},
		);
	});
}

const DEFAULT_WATCH_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_RENEW_ATTEMPTS = 5;

/**
 * Starts polling immediately (does not wait for the first tick) and
 * attempts to establish the push connection in the background -- a widget
 * gets an immediate refresh without waiting on a network round trip first.
 */
export function startWatchedRefresh(options: WatchedRefreshOptions): WatchedRefreshHandle {
	const watchTimeoutMs = options.watchTimeoutMs ?? DEFAULT_WATCH_TIMEOUT_MS;
	const maxRenewAttempts = options.maxRenewAttempts ?? DEFAULT_MAX_RENEW_ATTEMPTS;

	let pushChannel: PushChannelClient | undefined;
	let currentWatch: VehicleWatchTarget | undefined;
	/** The push target url resolvePushTarget() returned when currentWatch was established -- compared against its current value every tick to detect a daemon restart (see the file-level doc comment). */
	let watchEstablishedAgainstUrl: string | undefined;
	let renewing = false;
	let renewAttempts = 0;
	let timedOut = false;
	let stopped = false;

	function setState(state: WatchedRefreshState): void {
		if (stopped && state !== "canceled") return;
		options.onStateChange?.(state);
	}

	async function releasePrevious(target: VehicleWatchTarget | undefined): Promise<void> {
		if (!target || !options.unwatch) return;
		try {
			await options.unwatch(target);
		} catch {
			// Best-effort: the daemon instance that issued this watchId may already be gone,
			// in which case there is nothing left to release.
		}
	}

	function renew(): void {
		if (stopped || renewing || timedOut) return;
		renewing = true;
		setState(currentWatch ? "renewing" : "connecting");
		const staleWatch = currentWatch;
		void withTimeout(options.watch(), watchTimeoutMs)
			.then(async (target) => {
				await releasePrevious(staleWatch);
				if (stopped || !target) {
					setState("polling");
					return;
				}
				const pushTarget = options.resolvePushTarget();
				if (!pushTarget) {
					currentWatch = target;
					watchEstablishedAgainstUrl = undefined;
					setState("polling");
					return;
				}
				pushChannel?.close();
				currentWatch = target;
				watchEstablishedAgainstUrl = pushTarget.url;
				renewAttempts = 0;
				pushChannel = connectPushChannel({
					url: () => {
						const resolved = options.resolvePushTarget();
						if (!resolved) throw new Error("Vehicle push target is not currently resolvable");
						return resolved.url;
					},
					token: pushTarget.token,
					topics: [target.topic],
					onMessage: (topic) => {
						if (topic === target.topic) void options.refresh();
					},
					WebSocketImpl: options.WebSocketImpl,
				});
				setState("connected");
			})
			.catch(async () => {
				// watch() timed out or rejected (daemon unreachable, etc.) -- release is still
				// attempted best-effort in case the old instance is in fact still reachable.
				await releasePrevious(staleWatch);
				renewAttempts += 1;
				if (renewAttempts >= maxRenewAttempts) {
					timedOut = true;
					setState("timed-out");
				} else {
					setState("resolver-failed");
				}
			})
			.finally(() => {
				renewing = false;
			});
	}

	void options.refresh();
	renew();
	const timer = setInterval(() => {
		void options.refresh();
		if (stopped) return;
		const pushTarget = options.resolvePushTarget();
		const identityChanged =
			currentWatch !== undefined && watchEstablishedAgainstUrl !== undefined && pushTarget?.url !== watchEstablishedAgainstUrl;
		const disconnected = !pushChannel || pushChannel.state() === "closed";
		if (identityChanged || (disconnected && !renewing)) {
			if (identityChanged) renewAttempts = 0; // a fresh daemon instance deserves a fresh attempt budget, not the old one's leftover count
			renew();
		}
	}, options.pollIntervalMs);

	return {
		stop() {
			if (stopped) return;
			stopped = true;
			clearInterval(timer);
			pushChannel?.close();
			pushChannel = undefined;
			void releasePrevious(currentWatch);
			currentWatch = undefined;
			setState("canceled");
		},
		reportUnknownWatch() {
			if (stopped || renewing) return;
			pushChannel?.close();
			pushChannel = undefined;
			renew();
		},
	};
}
