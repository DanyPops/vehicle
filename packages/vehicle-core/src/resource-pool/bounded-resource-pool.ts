import { ResourceAdmissionQueueFull, ResourceAdmissionQueueTimedOut, ResourceCapacityExceeded, ResourceInUse } from "./errors.js";
import type { ResourcePoolActiveCeilingSource, ResourcePoolResourcePolicy } from "./resource-policy.js";

export { ResourceAdmissionQueueFull, ResourceAdmissionQueueTimedOut, ResourceCapacityExceeded, ResourceInUse };

/** A resource the pool can shut down when it goes cold. costHandle, when present, is an opaque token a cost-sampling hook may key off (e.g. a subprocess pid) -- undefined for a resource with nothing external to sample. */
export interface PooledResource {
	close(): Promise<void>;
	isAlive?(): boolean;
	readonly costHandle?: unknown;
}

const DEFAULT_MAX_ACTIVE = 3;
/** A genuine structural ceiling on resource count -- independent of memory, protecting against pathological OS-level exhaustion (file descriptors, threads, scheduler overhead) that no amount of available headroom makes safe to exceed. maxActive itself can never be raised past this by a resource policy's own soft ceiling. */
const DEFAULT_ABSOLUTE_MAX_ACTIVE = 32;
const DEFAULT_BACKGROUND_ADMISSION_QUEUE_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_QUEUED_BACKGROUND_ADMISSIONS = 8;

/**
 * Distinguishes an interactive human/agent-facing request from a self-scheduled background one.
 * Foreground admission is never queued or reduced below reservedForegroundSlots' effective
 * ceiling -- background is the only work kind that ever waits. Defaults to "foreground": a caller
 * that never opts in gets today's exact unreserved behavior.
 */
export type ResourceWorkKind = "foreground" | "background";

/**
 * Internal signal only: admit() throws this to tell acquire() "release the serialized lock and
 * wait outside it" -- never surfaced to a caller. Waiting for a background admission's turn can
 * legitimately take seconds; holding admissionTail (the single global admission mutex) for that
 * whole span would block every OTHER admission request, including foreground's, which is exactly
 * the starvation this exists to prevent.
 */
class NeedsBackgroundAdmissionWait extends Error {}

export type ResourcePoolEvent =
	| { readonly kind: "admission-evicted" | "dead-replaced" | "resource-pressure-evicted"; readonly partitionKey: string }
	| {
			readonly kind: "close-failed";
			readonly reason: "admission" | "dead-replacement" | "idle-reap" | "resource-pressure";
			readonly partitionKey: string;
			readonly errorName: string;
	  };

export interface ResourcePoolStatus<Status = unknown> {
	readonly active: number;
	readonly leased: number;
	readonly maxActive: number;
	/** The count ceiling actually in effect for the most recent admission -- may exceed maxActive when a resource policy's own soft ceiling raised it, never exceeds absoluteMaxActive. */
	readonly effectiveMaxActive: number;
	readonly activeCeilingSource: ResourcePoolActiveCeilingSource;
	readonly absoluteMaxActive: number;
	readonly byPartition: Readonly<Record<string, number>>;
	readonly resources?: Status;
	/** How many background admissions are currently waiting for a slot reserved for foreground work -- count-only, zero whenever reservedForegroundSlots is unset or nothing is contending. */
	readonly waitingBackgroundAdmissions: number;
}

export interface PoolLease<Value> extends AsyncDisposable {
	readonly value: Value;
}

export interface ResourcePoolOptions<Status = unknown> {
	readonly maxActive?: number;
	readonly partitionLimits?: Readonly<Record<string, number>>;
	readonly resourcePolicy?: ResourcePoolResourcePolicy<Status>;
	/** The hard structural ceiling a resource policy's own soft ceiling can never raise maxActive past. Defaults to 32. Must be >= maxActive. */
	readonly absoluteMaxActive?: number;
	readonly observe?: (event: ResourcePoolEvent) => void;
	/** Slots background admission alone can never grow into. Default 0 (no reservation). */
	readonly reservedForegroundSlots?: number;
	/** How long a queued background admission waits for a slot before giving up with ResourceAdmissionQueueTimedOut. Default 10s. */
	readonly backgroundAdmissionQueueTimeoutMs?: number;
	/** How many background admissions may be simultaneously waiting before a new one fails fast with ResourceAdmissionQueueFull instead of growing the wait queue further. Default 8. */
	readonly maxQueuedBackgroundAdmissions?: number;
	/** Fed one (partitionKey, costHandle) pair per active entry with a costHandle on calibrateCosts(). */
	readonly costRecorder?: { recordSample(partitionKey: string, costHandle: unknown): void };
	readonly now?: () => number;
}

interface PoolEntry<OwnerKey extends string, Resource extends PooledResource> {
	readonly resource: Resource;
	readonly ownerKey: OwnerKey;
	readonly partitionKey: string;
	recencySequence: number;
	activeLeases: number;
	lastUsedAt: number;
}

/**
 * Owns the bounded lifecycle of pooled, expensive, stateful resources partitioned by an
 * (ownerKey, partitionKey) pair -- e.g. one warm language-server process per (workspace,
 * language), one warm browser context per (tenant, profile). Never knows how to build a resource:
 * `acquire()` takes a lazy factory invoked only on an actual cache miss, so every caller-specific
 * concept (what a resource even is, how to construct one) lives entirely in the caller's own
 * closure at each call site.
 */
export class BoundedResourcePool<OwnerKey extends string, Resource extends PooledResource, Status = unknown> {
	private readonly entries = new Map<string, PoolEntry<OwnerKey, Resource>>();
	private readonly now: () => number;
	private readonly maxActive: number;
	private readonly absoluteMaxActive: number;
	private lastActiveCeilingSource: ResourcePoolActiveCeilingSource = "configured";
	private lastEffectiveMaxActive: number;
	private readonly partitionLimits: Readonly<Record<string, number>>;
	private admissionTail: Promise<void> = Promise.resolve();
	private nextSequence = 0;
	private readonly reservedForegroundSlots: number;
	private readonly backgroundAdmissionQueueTimeoutMs: number;
	private readonly maxQueuedBackgroundAdmissions: number;
	private readonly admissionWaiters = new Set<() => void>();
	private queuedBackgroundAdmissions = 0;
	private readonly waitingCounts = new Map<string, number>();

	constructor(private readonly options: ResourcePoolOptions<Status> = {}) {
		this.now = options.now ?? Date.now;
		this.maxActive = options.maxActive ?? DEFAULT_MAX_ACTIVE;
		this.partitionLimits = options.partitionLimits ?? {};
		if (!Number.isSafeInteger(this.maxActive) || this.maxActive < 1) throw new TypeError("maxActive must be a positive safe integer");
		this.absoluteMaxActive = options.absoluteMaxActive ?? Math.max(DEFAULT_ABSOLUTE_MAX_ACTIVE, this.maxActive);
		if (!Number.isSafeInteger(this.absoluteMaxActive) || this.absoluteMaxActive < this.maxActive) {
			throw new TypeError("absoluteMaxActive must be a safe integer no smaller than maxActive");
		}
		this.lastEffectiveMaxActive = this.maxActive;
		for (const [partitionKey, limit] of Object.entries(this.partitionLimits)) {
			if (!partitionKey || !Number.isSafeInteger(limit) || limit < 1) throw new TypeError("partition limits must be positive safe integers keyed by partition key");
		}
		this.reservedForegroundSlots = options.reservedForegroundSlots ?? 0;
		if (!Number.isSafeInteger(this.reservedForegroundSlots) || this.reservedForegroundSlots < 0) {
			throw new TypeError("reservedForegroundSlots must be a non-negative safe integer");
		}
		this.backgroundAdmissionQueueTimeoutMs = options.backgroundAdmissionQueueTimeoutMs ?? DEFAULT_BACKGROUND_ADMISSION_QUEUE_TIMEOUT_MS;
		if (!Number.isSafeInteger(this.backgroundAdmissionQueueTimeoutMs) || this.backgroundAdmissionQueueTimeoutMs < 0) {
			throw new TypeError("backgroundAdmissionQueueTimeoutMs must be a non-negative safe integer");
		}
		this.maxQueuedBackgroundAdmissions = options.maxQueuedBackgroundAdmissions ?? DEFAULT_MAX_QUEUED_BACKGROUND_ADMISSIONS;
		if (!Number.isSafeInteger(this.maxQueuedBackgroundAdmissions) || this.maxQueuedBackgroundAdmissions < 1) {
			throw new TypeError("maxQueuedBackgroundAdmissions must be a positive safe integer");
		}
	}

	private key(ownerKey: OwnerKey, partitionKey: string): string {
		return `${ownerKey}:${partitionKey}`;
	}

	private partitionLimit(partitionKey: string): number {
		return this.partitionLimits[partitionKey] ?? this.maxActive;
	}

	private countPartition(partitionKey: string): number {
		let count = 0;
		for (const entry of this.entries.values()) if (entry.partitionKey === partitionKey) count++;
		return count;
	}

	private activePartitions(): string[] {
		return Array.from(this.entries.values(), (entry) => entry.partitionKey);
	}

	private leastRecentlyUsedIdle(partitionKey?: string): [string, PoolEntry<OwnerKey, Resource>] | undefined {
		let selected: [string, PoolEntry<OwnerKey, Resource>] | undefined;
		for (const candidate of this.entries) {
			const entry = candidate[1];
			if (entry.activeLeases > 0 || (partitionKey !== undefined && entry.partitionKey !== partitionKey)) continue;
			const current = selected?.[1];
			if (!current || entry.lastUsedAt < current.lastUsedAt || (entry.lastUsedAt === current.lastUsedAt && entry.recencySequence < current.recencySequence))
				selected = candidate;
		}
		return selected;
	}

	private async evict(
		entry: [string, PoolEntry<OwnerKey, Resource>],
		reason: "admission" | "dead-replacement" | "resource-pressure" = "admission",
	): Promise<void> {
		try {
			await entry[1].resource.close();
		} catch (error) {
			this.options.observe?.({
				kind: "close-failed",
				reason,
				partitionKey: entry[1].partitionKey,
				errorName: error instanceof Error ? error.name : "UnknownError",
			});
			throw error;
		}
		this.entries.delete(entry[0]);
		const kind = reason === "admission" ? "admission-evicted" : reason === "dead-replacement" ? "dead-replaced" : "resource-pressure-evicted";
		this.options.observe?.({ kind, partitionKey: entry[1].partitionKey });
		this.notifyAdmissionWaiters();
	}

	/** Wakes every queued background admission to re-check the real state -- called whenever an entry is removed OR a lease completes (an idle candidate an admit() retry might now be able to evict). A false wake just re-checks and re-waits; never a correctness issue, only a wasted retry. */
	private notifyAdmissionWaiters(): void {
		if (this.admissionWaiters.size === 0) return;
		const waiters = Array.from(this.admissionWaiters);
		this.admissionWaiters.clear();
		for (const waiter of waiters) waiter();
	}

	/** True while at least one background admission for this owner is currently waiting for a reserved-slot conflict to clear. */
	waitingForAdmission(ownerKey: OwnerKey): boolean {
		return (this.waitingCounts.get(ownerKey) ?? 0) > 0;
	}

	/**
	 * Runs entirely outside the serialized admission lock -- admissionTail is the single global
	 * admission mutex, and this wait can legitimately take up to backgroundAdmissionQueueTimeoutMs.
	 * Holding that lock for the whole wait would block every other admission request, foreground
	 * included, which is the exact starvation this exists to prevent.
	 */
	private async waitForAdmissionRoom(partitionKey: string, ownerKey: OwnerKey): Promise<void> {
		if (this.queuedBackgroundAdmissions >= this.maxQueuedBackgroundAdmissions) {
			throw new ResourceAdmissionQueueFull(partitionKey, this.maxQueuedBackgroundAdmissions);
		}
		this.queuedBackgroundAdmissions++;
		this.waitingCounts.set(ownerKey, (this.waitingCounts.get(ownerKey) ?? 0) + 1);
		try {
			const gotSignal = await new Promise<boolean>((resolve) => {
				let settled = false;
				const finish = (ready: boolean): void => {
					if (settled) return;
					settled = true;
					clearTimeout(timer);
					this.admissionWaiters.delete(onSignal);
					resolve(ready);
				};
				const onSignal = (): void => finish(true);
				const timer = setTimeout(() => finish(false), this.backgroundAdmissionQueueTimeoutMs);
				this.admissionWaiters.add(onSignal);
			});
			if (!gotSignal) throw new ResourceAdmissionQueueTimedOut(partitionKey, this.backgroundAdmissionQueueTimeoutMs);
		} finally {
			this.queuedBackgroundAdmissions--;
			const remaining = (this.waitingCounts.get(ownerKey) ?? 1) - 1;
			if (remaining <= 0) this.waitingCounts.delete(ownerKey);
			else this.waitingCounts.set(ownerKey, remaining);
		}
	}

	private async admit(ownerKey: OwnerKey, partitionKey: string, create: () => Resource, workKind: ResourceWorkKind): Promise<PoolEntry<OwnerKey, Resource>> {
		const partitionLimit = this.partitionLimit(partitionKey);
		while (this.countPartition(partitionKey) >= partitionLimit) {
			const victim = this.leastRecentlyUsedIdle(partitionKey);
			if (!victim) throw new ResourceCapacityExceeded(partitionKey, this.maxActive, partitionLimit);
			await this.evict(victim);
		}
		const { ceiling: baseCeiling, source: ceilingSource } = this.baseActiveCeiling();
		this.lastEffectiveMaxActive = baseCeiling;
		this.lastActiveCeilingSource = ceilingSource;
		// "Borrowable": background's own effective ceiling is reduced, but only background is ever
		// held to it -- it constrains what background alone can grow the pool into, not a hard
		// set-aside nothing else can reach. Foreground keeps using the full (possibly resource-
		// budget-raised) baseCeiling unchanged.
		const effectiveMaxActive = workKind === "background" ? Math.max(baseCeiling - this.reservedForegroundSlots, 0) : baseCeiling;
		while (this.entries.size >= effectiveMaxActive) {
			const victim = this.leastRecentlyUsedIdle();
			if (victim) {
				await this.evict(victim);
				continue;
			}
			if (workKind === "background") throw new NeedsBackgroundAdmissionWait();
			throw new ResourceCapacityExceeded(partitionKey, baseCeiling, partitionLimit);
		}
		while (this.options.resourcePolicy && !this.options.resourcePolicy.canAdmit(this.activePartitions(), partitionKey)) {
			const victim = this.leastRecentlyUsedIdle();
			if (!victim) throw new ResourceCapacityExceeded(partitionKey, baseCeiling, partitionLimit);
			await this.evict(victim, "resource-pressure");
		}
		return {
			resource: create(),
			ownerKey,
			partitionKey,
			recencySequence: this.nextSequence++,
			activeLeases: 0,
			lastUsedAt: this.now(),
		};
	}

	private async serialized<Value>(operation: () => Promise<Value>): Promise<Value> {
		const previous = this.admissionTail;
		let release = (): void => {};
		this.admissionTail = new Promise<void>((resolve) => {
			release = resolve;
		});
		await previous;
		try {
			return await operation();
		} finally {
			release();
		}
	}

	/** Acquires a lease for (ownerKey, partitionKey), reusing an already-admitted resource if one is warm, or admitting a fresh one via `create()` -- called only on an actual cache miss, never speculatively. workKind defaults to "foreground". */
	async acquire(ownerKey: OwnerKey, partitionKey: string, create: () => Resource, workKind: ResourceWorkKind = "foreground"): Promise<PoolLease<Resource>> {
		for (;;) {
			try {
				const entry = await this.serialized(async () => {
					const key = this.key(ownerKey, partitionKey);
					let entry = this.entries.get(key);
					if (entry?.resource.isAlive?.() === false) {
						if (entry.activeLeases > 0) {
							throw new ResourceCapacityExceeded(partitionKey, this.maxActive, this.partitionLimit(partitionKey));
						}
						await this.evict([key, entry], "dead-replacement");
						entry = undefined;
					}
					if (!entry) {
						entry = await this.admit(ownerKey, partitionKey, create, workKind);
						this.entries.set(key, entry);
					}
					entry.activeLeases++;
					return entry;
				});
				return this.lease(entry.resource, [entry]);
			} catch (error) {
				if (!(error instanceof NeedsBackgroundAdmissionWait)) throw error;
				// Outside the lock deliberately -- see waitForAdmissionRoom's own comment. Throws
				// ResourceAdmissionQueueFull/TimedOut instead of looping back if it can't wait.
				await this.waitForAdmissionRoom(partitionKey, ownerKey);
			}
		}
	}

	private lease<Value>(value: Value, entries: readonly PoolEntry<OwnerKey, Resource>[]): PoolLease<Value> {
		let released = false;
		return {
			value,
			[Symbol.asyncDispose]: async () => {
				if (released) return;
				released = true;
				const completedAt = this.now();
				for (const entry of entries) {
					entry.activeLeases--;
					entry.lastUsedAt = completedAt;
					entry.recencySequence = this.nextSequence++;
				}
				// A lease completing makes its entry newly idle -- exactly the condition a queued
				// background admission's retry is waiting to find, whether or not resource pressure
				// itself ends up evicting anything below.
				this.notifyAdmissionWaiters();
				await this.reconcileResources();
			},
		};
	}

	has(ownerKey: OwnerKey, partitionKey: string): boolean {
		return this.entries.has(this.key(ownerKey, partitionKey));
	}

	hasAny(ownerKey: OwnerKey): boolean {
		for (const entry of this.entries.values()) if (entry.ownerKey === ownerKey) return true;
		return false;
	}

	/** Every currently active resource belonging to `ownerKey` -- lets a caller's own fan-out (file-watch notifications, etc) stay pool-backed instead of duplicating the entry map. */
	activeResourcesForOwner(ownerKey: OwnerKey): readonly Resource[] {
		const resources: Resource[] = [];
		for (const entry of this.entries.values()) if (entry.ownerKey === ownerKey) resources.push(entry.resource);
		return resources;
	}

	/**
	 * Derives the count ceiling actually in effect right now, independent of any particular
	 * admission attempt -- the resource policy's own soft ceiling raises maxActive when it reports
	 * more room, clamped to absoluteMaxActive, and falls back to maxActive alone (source
	 * "configured") on any metric loss -- fails closed, never treated as "unlimited room."
	 */
	private baseActiveCeiling(): { readonly ceiling: number; readonly source: ResourcePoolActiveCeilingSource } {
		const soft = this.options.resourcePolicy?.softActiveCeiling(this.activePartitions());
		if (soft === undefined || !Number.isFinite(soft) || soft <= this.maxActive) return { ceiling: this.maxActive, source: "configured" };
		const clamped = Math.min(Math.floor(soft), this.absoluteMaxActive);
		return { ceiling: clamped, source: clamped >= this.absoluteMaxActive ? "absolute-cap" : "resource-budget" };
	}

	status(): ResourcePoolStatus<Status> {
		const byPartition: Record<string, number> = {};
		let leased = 0;
		for (const entry of this.entries.values()) {
			byPartition[entry.partitionKey] = (byPartition[entry.partitionKey] ?? 0) + 1;
			if (entry.activeLeases > 0) leased++;
		}
		const resources = this.options.resourcePolicy?.status(this.activePartitions());
		return {
			active: this.entries.size,
			leased,
			maxActive: this.maxActive,
			effectiveMaxActive: this.lastEffectiveMaxActive,
			activeCeilingSource: this.lastActiveCeilingSource,
			absoluteMaxActive: this.absoluteMaxActive,
			byPartition,
			waitingBackgroundAdmissions: this.queuedBackgroundAdmissions,
			...(resources !== undefined ? { resources } : {}),
		};
	}

	/** Samples every currently active entry with a real costHandle and folds it into the configured recorder, if any -- a no-op without one. Read-only over the entry map, so it deliberately does not run inside serialized(). */
	calibrateCosts(): void {
		const recorder = this.options.costRecorder;
		if (!recorder) return;
		for (const entry of this.entries.values()) {
			if (entry.resource.costHandle === undefined) continue;
			recorder.recordSample(entry.partitionKey, entry.resource.costHandle);
		}
	}

	/** Unconditional force-close of every one of `ownerKey`'s resources, regardless of any active lease -- for the case of a remote resource swapped out from under an already-warm one, where correctness requires closing regardless of who still holds it. */
	async closeOwner(ownerKey: OwnerKey): Promise<void> {
		const stale = Array.from(this.entries.entries()).filter(([, entry]) => entry.ownerKey === ownerKey);
		for (const [key] of stale) this.entries.delete(key);
		await Promise.all(stale.map(([, entry]) => entry.resource.close()));
	}

	/** Unconditional force-close of one (ownerKey, partitionKey) resource, if any -- the single-partition sibling of closeOwner, for a caller that has already identified exactly which partition needs invalidating. */
	async closePartition(ownerKey: OwnerKey, partitionKey: string): Promise<void> {
		const key = this.key(ownerKey, partitionKey);
		const entry = this.entries.get(key);
		if (!entry) return;
		this.entries.delete(key);
		await entry.resource.close();
	}

	/**
	 * The safe sibling of closeOwner: refuses (does not evict anything) while any of this owner's
	 * resources has an active lease. Serialized against concurrent admission so a lease can't be
	 * granted between the check and the close.
	 */
	async releaseOwnerIfIdle(ownerKey: OwnerKey): Promise<{ readonly closed: number }> {
		return this.serialized(async () => {
			const matching = Array.from(this.entries.entries()).filter(([, entry]) => entry.ownerKey === ownerKey);
			if (matching.some(([, entry]) => entry.activeLeases > 0)) throw new ResourceInUse(ownerKey);
			for (const pair of matching) await this.evict(pair, "admission");
			return { closed: matching.length };
		});
	}

	async closeAll(): Promise<void> {
		const entries = Array.from(this.entries.values());
		this.entries.clear();
		await Promise.all(entries.map((entry) => entry.resource.close()));
	}

	private async reconcileResourcesUnsafe(): Promise<number> {
		const policy = this.options.resourcePolicy;
		if (!policy) return 0;
		let reaped = 0;
		while (policy.isOverBudget(this.activePartitions())) {
			const victim = this.leastRecentlyUsedIdle();
			if (!victim) break;
			try {
				await this.evict(victim, "resource-pressure");
				reaped++;
			} catch {
				break;
			}
		}
		return reaped;
	}

	async reconcileResources(): Promise<number> {
		return this.serialized(() => this.reconcileResourcesUnsafe());
	}

	async reapIdle(maxIdleMs: number): Promise<number> {
		return this.serialized(async () => {
			let reaped = await this.reconcileResourcesUnsafe();
			const now = this.now();
			const effectiveMaxIdleMs = this.options.resourcePolicy?.maxIdleMs(maxIdleMs, this.activePartitions()) ?? maxIdleMs;
			const idle = Array.from(this.entries.entries()).filter(([, entry]) => entry.activeLeases === 0 && now - entry.lastUsedAt > effectiveMaxIdleMs);
			for (const [key, entry] of idle) {
				try {
					await entry.resource.close();
					if (this.entries.get(key) === entry) this.entries.delete(key);
					reaped++;
				} catch (error) {
					this.options.observe?.({
						kind: "close-failed",
						reason: "idle-reap",
						partitionKey: entry.partitionKey,
						errorName: error instanceof Error ? error.name : "UnknownError",
					});
				}
			}
			if (idle.length > 0) this.notifyAdmissionWaiters();
			return reaped;
		});
	}
}
