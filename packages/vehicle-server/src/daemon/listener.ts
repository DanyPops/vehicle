/**
 * Shared listener-adapter types for the Bun/Node HTTP runtime adapters. Split out of daemon.ts's
 * own bundled concerns (Vehicle Pass 1 SRP audit finding #7).
 */

export interface ListeningServer {
	port: number;
	stop(): Promise<void>;
}

export type DaemonApp = { fetch(request: Request): Promise<Response> };
