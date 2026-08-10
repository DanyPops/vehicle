import { describe, expect, it } from "bun:test";
import { enforceReleaseDiscipline, findBreakingTypeCandidates } from "../check-release-discipline.mjs";

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
