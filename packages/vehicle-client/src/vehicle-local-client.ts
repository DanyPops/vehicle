/**
 * A VehicleClient that calls a same-process VehicleRegistry directly, no
 * wire involved -- for a daemon calling its own registered operations, or
 * a host embedding a provider and its consumer in one process. Depends on
 * @danypops/vehicle-server only for VehicleRegistry's type; every other
 * VehicleClient in this package (vehicle-http-client.ts) has no such
 * dependency, which is why this file is its own subpath (./local) rather
 * than folded into a shared barrel.
 */

import type {
	VehicleClient,
	VehicleEventHandler,
	VehicleInvocationOptions,
	VehicleJobSnapshot,
	VehicleJobSubmitOptions,
	VehicleJobSubmitResult,
	VehicleJobTailResult,
	VehicleManifest,
	VehicleProtocolAgreement,
	VehicleProtocolOffer,
	VehicleSubscription,
} from "@danypops/vehicle-core";
import { VehicleError } from "@danypops/vehicle-core";
import type { VehicleRegistry } from "@danypops/vehicle-server";
import type { VehicleJobStore } from "@danypops/vehicle-server/jobs";

export interface LocalVehicleClientOptions {
	/** Opts this client into Vehicle Jobs (submitJob/pollJob/tailJob/steerJob/cancelJob) -- built on this
	 * same registry. Omitted (the default) means every job method throws jobs-not-configured, matching
	 * RemoteVehicleClient's own 404 when its daemon never wired one up. */
	jobStore?: VehicleJobStore;
}

/**
 * A `VehicleClient` that calls a same-process VehicleRegistry directly, no
 * wire involved -- for a daemon calling its own registered operations, or
 * a host embedding a provider and its consumer in one process. Depends on
 * `@danypops/vehicle-server` only for `VehicleRegistry`'s type;
 * `RemoteVehicleClient` (`./http`) has no such dependency.
 */
export class LocalVehicleClient implements VehicleClient {
	private closed = false;
	private readonly jobStore?: VehicleJobStore;

	constructor(
		private readonly registry: VehicleRegistry,
		options: LocalVehicleClientOptions = {},
	) {
		this.jobStore = options.jobStore;
	}

	// async, not a plain function returning Promise.resolve(...) -- ensureOpen()'s
	// synchronous throw must become a rejected promise like every other
	// VehicleClient method (invoke() below is already async for the same
	// reason), not escape as a synchronous exception a caller's .catch()
	// would never see. Found live via the shared local/HTTP conformance
	// suite: RemoteVehicleClient's manifest() is async and rejects correctly,
	// which is what exposed this one not doing the same.
	async manifest(): Promise<VehicleManifest> {
		this.ensureOpen();
		return this.registry.manifest();
	}

	async negotiate(offer: VehicleProtocolOffer): Promise<VehicleProtocolAgreement> {
		this.ensureOpen();
		return this.registry.negotiate(offer);
	}

	async invoke<Output = unknown>(name: string, version: number, input: unknown, options?: VehicleInvocationOptions): Promise<Output> {
		this.ensureOpen();
		return (await this.registry.invoke(name, version, input, options)) as Output;
	}

	/** In-process subscription -- zero network, built directly on the registry's own subscribeLocal(). */
	subscribe<Payload = unknown>(name: string, version: number, handler: VehicleEventHandler<Payload>): VehicleSubscription {
		this.ensureOpen();
		const unsubscribe = this.registry.subscribeLocal(name, version, handler as (payload: unknown) => void);
		return { close: unsubscribe };
	}

	/** Vehicle Jobs -- see VehicleClient's own doc comment. Delegates directly to this client's own jobStore, no wire involved, same as invoke() delegating to the registry. */
	async submitJob(name: string, version: number, input: unknown, options?: VehicleJobSubmitOptions): Promise<VehicleJobSubmitResult> {
		this.ensureOpen();
		return this.requireJobStore().submit(name, version, input, options);
	}

	async pollJob(jobId: string): Promise<VehicleJobSnapshot> {
		this.ensureOpen();
		return this.requireJobStore().poll(jobId);
	}

	async tailJob(jobId: string, cursor = 0): Promise<VehicleJobTailResult> {
		this.ensureOpen();
		return this.requireJobStore().tail(jobId, cursor);
	}

	async steerJob(jobId: string, input: unknown): Promise<void> {
		this.ensureOpen();
		this.requireJobStore().steer(jobId, input);
	}

	async cancelJob(jobId: string): Promise<void> {
		this.ensureOpen();
		this.requireJobStore().cancel(jobId);
	}

	close(): Promise<void> {
		this.closed = true;
		return Promise.resolve();
	}

	private requireJobStore(): VehicleJobStore {
		if (!this.jobStore) {
			throw new VehicleError("jobs-not-configured", "This LocalVehicleClient was constructed without a VehicleJobStore", {
				category: "unavailable",
			});
		}
		return this.jobStore;
	}

	private ensureOpen(): void {
		if (this.closed) {
			throw new VehicleError("client-closed", "Vehicle client is closed", {
				category: "unavailable",
			});
		}
	}
}
