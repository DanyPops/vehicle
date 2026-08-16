/**
 * node:http-backed HTTP listener adapter. Split out of daemon.ts's own bundled concerns (Vehicle
 * Pass 1 SRP audit finding #7).
 */

import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Socket } from "node:net";
import { Readable } from "node:stream";
import { LOOPBACK_HOST } from "../paths.ts";
import { runWithRpcCallId } from "../rpc-correlation.ts";
import type { DaemonApp, ListeningServer } from "./listener.ts";

/** Adapts a Node IncomingMessage into a standard Request -- buildApp()'s contract is already Web-standard/portable, so this is the only translation node:http needs. */
function nodeRequestToWebRequest(request: IncomingMessage): Request {
	const headers = new Headers();
	for (const [key, value] of Object.entries(request.headers)) {
		if (value === undefined) continue;
		if (Array.isArray(value)) for (const v of value) headers.append(key, v);
		else headers.append(key, value);
	}
	const method = request.method ?? "GET";
	const hasBody = method !== "GET" && method !== "HEAD";
	const url = `http://${request.headers.host ?? LOOPBACK_HOST}${request.url ?? "/"}`;
	const init: RequestInit & { duplex?: "half" } = { method, headers };
	if (hasBody) {
		init.body = Readable.toWeb(request) as unknown as ReadableStream;
		init.duplex = "half"; // required by Node's fetch implementation whenever a request carries a streamed body
	}
	return new Request(url, init);
}

/** Writes a standard Response back onto a Node ServerResponse. */
async function writeWebResponseToNode(response: Response, res: ServerResponse): Promise<void> {
	res.statusCode = response.status;
	response.headers.forEach((value, key) => {
		res.setHeader(key, value);
	});
	if (!response.body) {
		res.end();
		return;
	}
	await new Promise<void>((resolve, reject) => {
		const readable = Readable.fromWeb(response.body as never);
		readable.pipe(res);
		readable.on("end", resolve);
		readable.on("error", reject);
	});
}

export function startNodeListener(app: DaemonApp, onRequest: () => void): Promise<ListeningServer> {
	return new Promise((resolve, reject) => {
		const server = createServer((request, res) => {
			onRequest();
			void runWithRpcCallId(randomUUID(), async () => {
				try {
					const response = await app.fetch(nodeRequestToWebRequest(request));
					await writeWebResponseToNode(response, res);
				} catch (error) {
					res.statusCode = 500;
					res.end(error instanceof Error ? error.message : String(error));
				}
			});
		});
		// Tracked so stop() can force-close lingering keep-alive connections --
		// server.close() alone only stops accepting new ones and waits
		// indefinitely for existing ones to end on their own, unlike Bun's own
		// server.stop(true) force semantics this mirrors.
		const sockets = new Set<Socket>();
		server.on("connection", (socket) => {
			sockets.add(socket);
			socket.on("close", () => sockets.delete(socket));
		});
		server.once("error", reject);
		server.listen(0, LOOPBACK_HOST, () => {
			const address = server.address();
			const port = typeof address === "object" && address ? address.port : 0;
			resolve({
				port,
				stop: () =>
					new Promise<void>((resolveStop) => {
						for (const socket of sockets) socket.destroy();
						server.close(() => resolveStop());
					}),
			});
		});
	});
}
