/** Raised when no idle resource can be evicted to admit a new one within the current ceiling. */
export class ResourceCapacityExceeded extends Error {
	constructor(
		readonly partitionKey: string,
		readonly maxActive: number,
		readonly partitionLimit: number,
	) {
		super(`no idle resource can be evicted to admit partition "${partitionKey}" within global capacity ${maxActive} and partition capacity ${partitionLimit}`);
		this.name = "ResourceCapacityExceeded";
	}
}

/** Raised by releaseOwnerIfIdle when at least one of the owner's own resources still has an active lease. */
export class ResourceInUse extends Error {
	constructor(readonly ownerKey: string) {
		super(`cannot release owner "${ownerKey}": a pooled resource for it still has an active lease`);
		this.name = "ResourceInUse";
	}
}

/** Raised when background admission is already waiting at maxQueuedBackgroundAdmissions -- fails fast rather than growing the wait queue without bound. */
export class ResourceAdmissionQueueFull extends Error {
	constructor(
		readonly partitionKey: string,
		readonly maxQueued: number,
	) {
		super(`background admission for partition "${partitionKey}" is already waiting at capacity (${maxQueued} queued); retry later`);
		this.name = "ResourceAdmissionQueueFull";
	}
}

/** Raised when a queued background admission waits past backgroundAdmissionQueueTimeoutMs without a slot freeing. */
export class ResourceAdmissionQueueTimedOut extends Error {
	constructor(
		readonly partitionKey: string,
		readonly timeoutMs: number,
	) {
		super(
			`background admission for partition "${partitionKey}" waited ${timeoutMs}ms for a resource-pool slot and gave up -- foreground demand is holding every admittable slot`,
		);
		this.name = "ResourceAdmissionQueueTimedOut";
	}
}
