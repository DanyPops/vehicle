import type { VehicleJobSnapshot, VehicleJobSubmitOptions, VehicleJobSubmitResult, VehicleJobTailResult } from "../jobs/wire.js";
import type { VehicleManifest } from "../manifest/manifest.js";
import type { VehicleInvocationOptions } from "../operations/context.js";
import type { VehicleProtocolAgreement, VehicleProtocolOffer } from "../protocol/negotiation.js";

export interface VehicleSubscription {
	close(): void;
}

export interface VehicleClient {
	manifest(): Promise<VehicleManifest>;
	/** Optional for compatibility with clients authored before explicit wire negotiation. */
	negotiate?(offer: VehicleProtocolOffer): Promise<VehicleProtocolAgreement>;
	invoke<Output = unknown>(name: string, version: number, input: unknown, options?: VehicleInvocationOptions): Promise<Output>;
	close(): Promise<void>;
	/**
	 * Vehicle Jobs -- submit a background-capable operation (one whose descriptor declares
	 * `background`, see {@link VehicleBackgroundCapability}) and get its jobId back immediately,
	 * without waiting for the operation itself to make any progress. Optional: a client that
	 * never talks to a job-capable Vehicle (or a hand-rolled test double) simply omits these five
	 * methods, exactly like this interface's own long-standing `subscribe()`-shaped extras --
	 * present on both LocalVehicleClient and RemoteVehicleClient, absent elsewhere. Feature-detect
	 * via the operation's own manifest `background` capability, not by probing for these methods.
	 */
	submitJob?(name: string, version: number, input: unknown, options?: VehicleJobSubmitOptions): Promise<VehicleJobSubmitResult>;
	/** Never blocks -- current status, plus output/error once terminal. */
	pollJob?(jobId: string): Promise<VehicleJobSnapshot>;
	/** Progress entries strictly after `cursor` (0 for everything so far), plus the next cursor. Never blocks. */
	tailJob?(jobId: string, cursor?: number): Promise<VehicleJobTailResult>;
	/** Pushes new input to an already-running job's handler, if it opted in via context.steerInputs. */
	steerJob?(jobId: string, input: unknown): Promise<void>;
	/** Best-effort cancellation of a still-running job -- a no-op against an already-terminal one. */
	cancelJob?(jobId: string): Promise<void>;
}
