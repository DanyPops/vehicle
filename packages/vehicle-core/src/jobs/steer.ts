/**
 * A job's mid-flight input channel -- the "steer" primitive. Bounded FIFO:
 * push() while a handler isn't yet reading buffers up to maxQueueSize, then
 * refuses further input rather than growing unboundedly or silently
 * overwriting an unread entry. A handler consumes it via `for await (const
 * input of context.steerInputs)`, which ends cleanly once close() is
 * called (VehicleJobStore does this at job finalization).
 */
export interface VehicleJobSteerPushResult {
	readonly accepted: boolean;
	readonly dropReason?: "queue-full" | "channel-closed";
}

export class VehicleJobSteerChannel implements AsyncIterable<unknown> {
	private readonly buffer: unknown[] = [];
	private readonly waiters: ((result: IteratorResult<unknown>) => void)[] = [];
	private closed = false;

	constructor(private readonly maxQueueSize: number = 64) {}

	push(value: unknown): VehicleJobSteerPushResult {
		if (this.closed) return { accepted: false, dropReason: "channel-closed" };
		const waiter = this.waiters.shift();
		if (waiter) {
			waiter({ value, done: false });
			return { accepted: true };
		}
		if (this.buffer.length >= this.maxQueueSize) return { accepted: false, dropReason: "queue-full" };
		this.buffer.push(value);
		return { accepted: true };
	}

	/** Ends every pending and future iteration with done:true; further push() calls report "channel-closed". Idempotent. */
	close(): void {
		if (this.closed) return;
		this.closed = true;
		for (const waiter of this.waiters.splice(0)) waiter({ value: undefined, done: true });
	}

	[Symbol.asyncIterator](): AsyncIterator<unknown> {
		return {
			next: (): Promise<IteratorResult<unknown>> => {
				if (this.buffer.length > 0) return Promise.resolve({ value: this.buffer.shift(), done: false });
				if (this.closed) return Promise.resolve({ value: undefined, done: true });
				return new Promise((resolve) => this.waiters.push(resolve));
			},
		};
	}
}
