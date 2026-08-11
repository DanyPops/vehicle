import { describe, expect, it } from "bun:test";
import { closeSync, openSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getPeerCredential, PeerCredentialLookupError, rawSocketFd, UnsupportedPlatformError } from "../src/unix-peer-cred.ts";

function socketPath(): string {
	return join(tmpdir(), `daemon-kit-peer-cred-${process.pid}-${Math.random().toString(36).slice(2)}.sock`);
}

// process.getuid/getgid are typed optional (absent on Windows) but guaranteed present
// wherever this Linux-only suite actually runs -- asserted once, not per call site.
const realUid = process.getuid?.();
const realGid = process.getgid?.();
if (realUid === undefined || realGid === undefined)
	throw new Error("process.getuid/getgid unavailable -- this suite requires a POSIX platform");

describe("getPeerCredential", () => {
	it("reports the real kernel-verified uid/gid of a same-process connecting client", async () => {
		const path = socketPath();
		let server: ReturnType<typeof Bun.listen> | undefined;
		try {
			const seen = Promise.withResolvers<{ pid: number; uid: number; gid: number }>();
			server = Bun.listen({
				unix: path,
				socket: {
					open(socket) {
						const fd = rawSocketFd(socket);
						if (fd === undefined) return seen.reject(new Error("no fd on accepted socket"));
						seen.resolve(getPeerCredential(fd));
					},
					data() {},
					close() {},
				},
			});
			const client = await Bun.connect({ unix: path, socket: { open() {}, data() {}, close() {} } });
			const cred = await seen.promise;
			client.end();

			expect(cred.uid).toBe(realUid);
			expect(cred.gid).toBe(realGid);
			expect(cred.pid).toBeGreaterThan(0);
		} finally {
			server?.stop(true);
			try {
				unlinkSync(path);
			} catch {}
		}
	});

	it("reports the real pid of a genuinely separate connecting process, not just the current one", async () => {
		const path = socketPath();
		let server: ReturnType<typeof Bun.listen> | undefined;
		try {
			const seen = Promise.withResolvers<{ pid: number; uid: number; gid: number }>();
			server = Bun.listen({
				unix: path,
				socket: {
					open(socket) {
						const fd = rawSocketFd(socket);
						if (fd === undefined) return seen.reject(new Error("no fd on accepted socket"));
						seen.resolve(getPeerCredential(fd));
					},
					data() {},
					close() {},
				},
			});

			const child = Bun.spawn(
				[
					"bun",
					"-e",
					`const s = await Bun.connect({ unix: "${path}", socket: { open(){}, data(){}, close(){} } }); await Bun.sleep(200); s.end();`,
				],
				{
					stdout: "ignore",
					stderr: "ignore",
				},
			);
			const cred = await seen.promise;
			await child.exited;

			expect(cred.pid).toBe(child.pid);
			expect(cred.uid).toBe(realUid);
		} finally {
			server?.stop(true);
			try {
				unlinkSync(path);
			} catch {}
		}
	});

	it("rejects a negative or non-integer fd before ever calling into FFI", () => {
		expect(() => getPeerCredential(-1)).toThrow(TypeError);
		expect(() => getPeerCredential(1.5)).toThrow(TypeError);
	});

	it("throws PeerCredentialLookupError for a valid-looking fd that isn't actually a socket", () => {
		// A real, freshly-opened regular file -- guaranteed never a socket, unlike fd 0 (stdin), whose
		// own real backing depends entirely on however THIS test process itself was launched (a bare
		// terminal/pipe-backed bash invocation never has a socket there, but a process inherited from
		// a daemon's own stdio -- e.g. a gate command spawned without an explicit stdio override --
		// genuinely can, since fd 0 is a real socket in the daemon itself; confirmed live). getsockopt
		// must fail on a real non-socket fd regardless of which fd number the runtime happens to be, not
		// silently return garbage -- opening our own file sidesteps depending on the ambient process's
		// own fd 0 at all.
		const path = join(tmpdir(), `daemon-kit-peer-cred-not-a-socket-${process.pid}-${Math.random().toString(36).slice(2)}.txt`);
		writeFileSync(path, "not a socket");
		const fd = openSync(path, "r");
		try {
			expect(() => getPeerCredential(fd)).toThrow(PeerCredentialLookupError);
		} finally {
			closeSync(fd);
			unlinkSync(path);
		}
	});

	it("throws UnsupportedPlatformError outside Linux, rather than returning a wrong or empty result", () => {
		const original = process.platform;
		Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
		try {
			expect(() => getPeerCredential(3)).toThrow(UnsupportedPlatformError);
		} finally {
			Object.defineProperty(process, "platform", { value: original, configurable: true });
		}
	});
});

describe("rawSocketFd", () => {
	it("returns the numeric fd when present", () => {
		expect(rawSocketFd({ fd: 7 })).toBe(7);
	});

	it("returns undefined when absent or non-numeric, never throws", () => {
		expect(rawSocketFd({})).toBeUndefined();
		expect(rawSocketFd({ fd: "7" })).toBeUndefined();
		expect(rawSocketFd(null)).toBeUndefined();
	});
});
