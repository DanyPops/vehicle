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

/** Raised when one admission class is already at its configured queue bound. */
export class ResourceAdmissionQueueFull extends Error {
	constructor(
		readonly partitionKey: string,
		readonly maxQueued: number,
		readonly workKind: "foreground" | "background" = "background",
	) {
		super(`${workKind} admission for partition "${partitionKey}" is already waiting at capacity (${maxQueued} queued); retry later`);
		this.name = "ResourceAdmissionQueueFull";
	}
}

/** Raised when a queued admission waits past its configured timeout without room becoming available. */
export class ResourceAdmissionQueueTimedOut extends Error {
	constructor(
		readonly partitionKey: string,
		readonly timeoutMs: number,
		readonly workKind: "foreground" | "background" = "background",
	) {
		super(`${workKind} admission for partition "${partitionKey}" waited ${timeoutMs}ms for a resource-pool slot and gave up`);
		this.name = "ResourceAdmissionQueueTimedOut";
	}
}
