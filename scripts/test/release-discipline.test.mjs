import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	addedRequiredPropertyOwners,
	enforceReleaseDiscipline,
	findBreakingTypeCandidates,
	publicEntryDtsText,
} from "../check-release-discipline.mjs";

describe("release discipline", () => {
	it("detects exported declaration removal and required-field additions or renames", () => {
		const candidates = findBreakingTypeCandidates(`
-export interface RemovedPort {}
 export interface ServiceSpec {
-	readonly descriptorPath: string;
+	readonly handlePath: string;
+	readonly version: string;
 }
`);
		expect(candidates).toEqual({
			removedDeclarations: ["RemovedPort"],
			removedProperties: ["descriptorPath"],
			addedRequiredProperties: ["handlePath", "version"],
		});
	});

	it("ignores formatting-only declaration and property rewrites", () => {
		const candidates = findBreakingTypeCandidates(`
-export type Identity = Base & { readonly url?: never };
+export type Identity = (Base & { readonly url?: never });
-	readonly name: string;
+	readonly name: BrandedName;
`);
		expect(candidates).toEqual({ removedDeclarations: [], removedProperties: [], addedRequiredProperties: [] });
	});

	it("ignores a non-exported function's own multi-line parameter list -- not an interface property, even though each param sits on its own line", () => {
		const candidates = findBreakingTypeCandidates(`
 async function awaitWithSignal<T>(
-	operation: Promise<T>,
+	operation: Promise<T>,
+	signal: AbortSignal,
+	deadline: number,
+	operationId: string,
+	key: string,
+	timeoutMs: number,
 ): Promise<T> {
`);
		expect(candidates).toEqual({ removedDeclarations: [], removedProperties: [], addedRequiredProperties: [] });
	});

	it("still catches a required property added inside a real exported interface, even with the same param-list shape nearby", () => {
		const candidates = findBreakingTypeCandidates(`
 export interface ServiceSpec {
 	readonly descriptorPath: string;
+	readonly handlePath: string;
 }
 async function unrelatedHelper(
+	someParam: string,
 ): void {}
`);
		expect(candidates).toEqual({ removedDeclarations: [], removedProperties: [], addedRequiredProperties: ["handlePath"] });
	});

	it("resets brace-depth tracking at each hunk boundary -- an interface opened but not closed within its own hunk (the normal --unified=0 shape) must never bleed into a later, unrelated hunk's own multi-line parameter list", () => {
		// Mirrors a real `git diff --unified=0` shape: the interface's own closing `}` is
		// unchanged context and so never appears in a zero-context diff at all -- only the
		// added property line does. Confirmed live releasing vehicle-server 0.20.0: exactly
		// this shape (a new optional field in one interface, then an unrelated private
		// method's params refactored much later in the file) flagged the method's own
		// now-consolidated parameter names as "removed required properties".
		const candidates = findBreakingTypeCandidates(`
diff --git a/src/registry.ts b/src/registry.ts
index abc..def 100644
--- a/src/registry.ts
+++ b/src/registry.ts
@@ -10,0 +11,2 @@ export interface Options {
+	readonly enabled?: boolean;
@@ -50,10 +55 @@ class Registry {
-		key: string,
-		name: string,
-		version: number,
-		effect: string,
+		descriptor: Descriptor,
`);
		expect(candidates).toEqual({ removedDeclarations: [], removedProperties: [], addedRequiredProperties: [] });
	});

	it("still resets across a hunk boundary even when the interface's own opening line is itself part of the diff", () => {
		const candidates = findBreakingTypeCandidates(`
@@ -1,0 +2 @@
+export interface Widened {
@@ -20,3 +25 @@ function unrelated(
-	a: string,
-	b: string,
-	c: string,
+	combined: Combined,
`);
		// Widened's own body is never shown (its properties, if any, are on lines this hunk
		// never touches) -- the point is that its dangling, never-closed "{" must not keep
		// exportedAtDepth active into the unrelated function's own parameter-list hunk below.
		expect(candidates).toEqual({ removedDeclarations: [], removedProperties: [], addedRequiredProperties: [] });
	});

	it("requires an explicit pre-1.0 breaking note", () => {
		const candidates = { removedDeclarations: [], removedProperties: ["descriptorPath"], addedRequiredProperties: ["handlePath"] };
		expect(() =>
			enforceReleaseDiscipline({ previousVersion: "0.16.0", currentVersion: "0.17.0", candidates, releaseMessage: "feat: rename field" }),
		).toThrow("BREAKING CHANGE:");
		expect(() =>
			enforceReleaseDiscipline({
				previousVersion: "0.16.0",
				currentVersion: "0.17.0",
				candidates,
				releaseMessage: "feat: rename field\n\nBREAKING CHANGE: descriptorPath is now handlePath",
			}),
		).not.toThrow();
	});

	it("publicEntryDtsText reads only the package's own declared exports-map .d.ts targets, never an unrelated compiled file", () => {
		const dir = mkdtempSync(join(tmpdir(), "release-discipline-"));
		try {
			writeFileSync(
				join(dir, "package.json"),
				JSON.stringify({
					exports: { ".": { types: "./dist/index.d.ts" }, "./daemon": { types: "./dist/daemon.d.ts" } },
				}),
			);
			// Simulates dist/daemon.d.ts existing at the declared exports-map path.
			mkdirSync(join(dir, "dist"), { recursive: true });
			writeFileSync(join(dir, "dist/daemon.d.ts"), "export function startDaemon(): void");
			writeFileSync(join(dir, "dist/index.d.ts"), "export interface Public { readonly name: string }");
			// An internal sibling-only file tsc still compiles but that package.json's exports map
			// never points a consumer at -- must NOT be picked up.
			writeFileSync(join(dir, "dist/internal.d.ts"), "export interface ListeningServer { port: number }");

			const text = publicEntryDtsText(dir);
			expect(text).toContain("Public");
			expect(text).toContain("startDaemon");
			expect(text).not.toContain("ListeningServer");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("publicEntryDtsText returns an empty string when dist/ hasn't been built yet, so main()'s filter safely no-ops rather than under-reporting", () => {
		const dir = mkdtempSync(join(tmpdir(), "release-discipline-"));
		try {
			writeFileSync(join(dir, "package.json"), JSON.stringify({ exports: { ".": { types: "./dist/index.d.ts" } } }));
			expect(publicEntryDtsText(dir)).toBe("");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("addedRequiredPropertyOwners records which exported interface a required property was actually added under", () => {
		const owners = addedRequiredPropertyOwners(`
diff --git a/src/daemon/listener.ts b/src/daemon/listener.ts
+export interface ListeningServer {
+	port: number;
+}
diff --git a/src/daemon.ts b/src/daemon.ts
 export interface StartDaemonOptions {
+	readonly instanceId: string;
`);
		expect(owners.get("port")).toEqual(new Set(["ListeningServer"]));
		expect(owners.get("instanceId")).toEqual(new Set(["StartDaemonOptions"]));
	});

	it("a required property added to an interface that never reaches the package's own published .d.ts is not flagged as breaking, even though the bare property NAME collides with an unrelated, genuinely-public property elsewhere", () => {
		// Mirrors the real vehicle-server false positive: RunningDaemon.port is a real,
		// pre-existing, published-surface property; ListeningServer.port is a brand new,
		// internal-only, sibling-file-import-only property that happens to share the name.
		const diff = `
diff --git a/src/daemon/listener.ts b/src/daemon/listener.ts
+export interface ListeningServer {
+	port: number;
+}
`;
		const candidates = findBreakingTypeCandidates(diff);
		expect(candidates.addedRequiredProperties).toEqual(["port"]);

		const owners = addedRequiredPropertyOwners(diff);
		const publicDts = "export interface RunningDaemon { readonly port: number; readonly pid: number }";
		const filtered = candidates.addedRequiredProperties.filter((name) => {
			const ownerTypes = owners.get(name);
			if (!ownerTypes || ownerTypes.size === 0) return true;
			return [...ownerTypes].some((owner) => owner && publicDts.includes(owner));
		});
		expect(filtered).toEqual([]);
	});

	it("a required property added to an interface that DOES reach the package's own published .d.ts is still flagged", () => {
		const diff = `
diff --git a/src/daemon.ts b/src/daemon.ts
 export interface StartDaemonOptions {
+	readonly instanceId: string;
`;
		const candidates = findBreakingTypeCandidates(diff);
		const owners = addedRequiredPropertyOwners(diff);
		const publicDts = "export interface StartDaemonOptions { readonly port: number }";
		const filtered = candidates.addedRequiredProperties.filter((name) => {
			const ownerTypes = owners.get(name);
			if (!ownerTypes || ownerTypes.size === 0) return true;
			return [...ownerTypes].some((owner) => owner && publicDts.includes(owner));
		});
		expect(filtered).toEqual(["instanceId"]);
	});

	it("requires a major bump after 1.0", () => {
		const candidates = { removedDeclarations: ["OldPort"], removedProperties: [], addedRequiredProperties: [] };
		expect(() =>
			enforceReleaseDiscipline({
				previousVersion: "1.4.0",
				currentVersion: "1.5.0",
				candidates,
				releaseMessage: "BREAKING CHANGE: removed",
			}),
		).toThrow("major version bump");
	});
});
