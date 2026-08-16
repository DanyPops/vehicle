/**
 * connectPushChannel -- subscribes to a daemon's push-invalidation channel with real connection
 * resilience. Split out of daemon-client.ts's own bundled concerns -- still zero runtime imports
 * of its own, using only the global WebSocket (see daemon-client.ts's own module doc comment for
 * why that invariant matters for Pi's jiti-based extension loader).
 */

export type PushChannelState = "connecting" | "open" | "degraded" | "closed";

export interface PushChannelClientOptions {
	/**
	 * e.g. "ws://127.0.0.1:PORT/push" -- `token` is appended as a query
	 * parameter automatically (the WHATWG WebSocket constructor cannot set an
	 * Authorization header). A function is re-invoked on every reconnect
	 * attempt, not just the first -- required for a daemon that rebinds a new
	 * random port on every restart (the same problem connectWithPolicy solves
	 * for one-shot RPC by re-reading the handle file each time); a plain
	 * string only works if the daemon's port never changes across restarts.
	 */
	url: string | (() => string | Promise<string>);
	token: string;
	/** Re-sent as `{op:"subscribe",topic}` after every successful (re)connect -- a reconnect must not silently lose a subscription. */
	topics: readonly string[];
	onMessage: (topic: string, payload: unknown) => void;
	/** Fires on every state transition; useful for a status surface (see daemonStatus) or logging. */
	onStateChange?: (state: PushChannelState) => void;
	/** Defaults to 1000ms. */
	minReconnectDelayMs?: number;
	/** Defaults to 30000ms. */
	maxReconnectDelayMs?: number;
	/** Defaults to 1.5. */
	reconnectionDelayGrowFactor?: number;
	/** A connection must stay open this long before it counts as genuinely stable -- a drop before this elapses keeps the backoff climbing instead of resetting on every brief open. Defaults to 5000ms, mirroring the reference this is modeled on (partysocket's own minUptime). */
	minUptimeMs?: number;
	/** Defaults to 20000ms. */
	heartbeatIntervalMs?: number;
	/** No message (including a pong) received within this long after the last one means the connection is treated as dead even though it never fired a close event -- a TCP socket can stay open while the peer process is hung. Defaults to 45000ms. */
	heartbeatTimeoutMs?: number;
	/** Defaults to the global WebSocket. Injectable for tests. */
	WebSocketImpl?: typeof WebSocket;
}

export interface PushChannelClient {
	state(): PushChannelState;
	/** Permanently closes the connection -- no further reconnect attempts. */
	close(): void;
}

/**
 * Subscribes to a daemon's push-invalidation channel (push-channel.ts) with
 * real connection resilience, not a naive reconnect-on-close:
 *
 * - Exponential backoff (min/max/growFactor) gated by minUptimeMs, mirroring
 *   partysocket (the maintained continuation of reconnecting-websocket): a
 *   connection that opens then drops again immediately keeps the backoff
 *   climbing instead of resetting to fast retries on every brief open --
 *   the actual mechanism behind detecting "degraded", not just "down".
 * - Jitter added on top of that reference algorithm (which has none) -- the
 *   real shape here is several concurrent Pi sessions reconnecting to one
 *   Vehicle server after a restart; unjittered synchronized backoff would
 *   create a reconnect storm the moment the daemon comes back up.
 * - A heartbeat ping/timeout (mirroring ws-heartbeat) detects a socket that
 *   stays open while the daemon process itself is hung -- a plain
 *   reconnect-on-close strategy would never notice that.
 * - Re-subscribes every requested topic after each successful (re)connect.
 *
 * Uses only the global WebSocket -- no import, keeping this module's
 * "no imports of its own" invariant for Pi's jiti loader (see the module
 * doc comment). Node 22+ and Bun both provide it as a global.
 */
export function connectPushChannel(options: PushChannelClientOptions): PushChannelClient {
	const WS = options.WebSocketImpl ?? WebSocket;
	const minDelay = options.minReconnectDelayMs ?? 1_000;
	const maxDelay = options.maxReconnectDelayMs ?? 30_000;
	const growFactor = options.reconnectionDelayGrowFactor ?? 1.5;
	const minUptimeMs = options.minUptimeMs ?? 5_000;
	const heartbeatIntervalMs = options.heartbeatIntervalMs ?? 20_000;
	const heartbeatTimeoutMs = options.heartbeatTimeoutMs ?? 45_000;

	let retryCount = 0;
	let everOpened = false;
	let state: PushChannelState = "connecting";
	let closed = false;
	let ws: WebSocket | undefined;
	let uptimeTimer: ReturnType<typeof setTimeout> | undefined;
	let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
	let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
	let lastMessageAt = Date.now();

	function setState(next: PushChannelState): void {
		if (state === next) return;
		state = next;
		options.onStateChange?.(next);
	}

	function nextDelay(): number {
		if (retryCount <= 0) return 0;
		const raw = Math.min(minDelay * growFactor ** (retryCount - 1), maxDelay);
		return raw * (0.8 + Math.random() * 0.4); // +/-20% jitter
	}

	function stopHeartbeat(): void {
		if (heartbeatTimer) clearInterval(heartbeatTimer);
		heartbeatTimer = undefined;
	}

	function startHeartbeat(): void {
		lastMessageAt = Date.now();
		heartbeatTimer = setInterval(() => {
			if (Date.now() - lastMessageAt > heartbeatTimeoutMs) {
				ws?.close();
				return;
			}
			try {
				ws?.send(JSON.stringify({ op: "ping" }));
			} catch {
				// The close/error handler drives reconnection; a failed send is not fatal on its own.
			}
		}, heartbeatIntervalMs);
	}

	function handleDown(): void {
		if (uptimeTimer) clearTimeout(uptimeTimer);
		stopHeartbeat();
		if (closed) return;
		setState(everOpened ? "degraded" : "connecting");
		retryCount++;
		reconnectTimer = setTimeout(() => void connect(), nextDelay());
	}

	async function connect(): Promise<void> {
		if (closed) return;
		let resolvedUrl: string;
		try {
			resolvedUrl = typeof options.url === "function" ? await options.url() : options.url;
		} catch {
			// The URL provider itself failed (e.g. no handle file -- daemon isn't up).
			// Treat exactly like a failed connection attempt rather than throwing
			// out of a timer callback.
			handleDown();
			return;
		}
		if (closed) return;
		const separator = resolvedUrl.includes("?") ? "&" : "?";
		const socket = new WS(`${resolvedUrl}${separator}token=${encodeURIComponent(options.token)}`);
		ws = socket;
		let settled = false;
		const onDown = (): void => {
			if (settled) return;
			settled = true;
			handleDown();
		};

		socket.addEventListener("open", () => {
			lastMessageAt = Date.now();
			for (const topic of options.topics) socket.send(JSON.stringify({ op: "subscribe", topic }));
			startHeartbeat();
			uptimeTimer = setTimeout(() => {
				retryCount = 0;
				everOpened = true;
				setState("open");
			}, minUptimeMs);
		});

		socket.addEventListener("message", (event: MessageEvent) => {
			lastMessageAt = Date.now();
			let parsed: { topic?: unknown; payload?: unknown; op?: unknown };
			try {
				parsed = JSON.parse(String(event.data)) as typeof parsed;
			} catch {
				return;
			}
			if (parsed.op === "pong") return;
			if (typeof parsed.topic === "string") options.onMessage(parsed.topic, parsed.payload);
		});

		socket.addEventListener("close", onDown);
		socket.addEventListener("error", onDown);
	}

	void connect();

	return {
		state: () => state,
		close: () => {
			closed = true;
			if (reconnectTimer) clearTimeout(reconnectTimer);
			if (uptimeTimer) clearTimeout(uptimeTimer);
			stopHeartbeat();
			setState("closed");
			ws?.close();
		},
	};
}
