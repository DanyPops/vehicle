import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Regression coverage for a real bug caught live by pi-web-spider's own "loads under Node's
 * native ESM baseline" test: vehicle-shell.ts previously statically imported (a real, VALUE-level
 * import, evaluated eagerly as part of the whole module graph) vehicle-shell-broker.ts, which
 * itself imports @danypops/vehicle-server/paths -- a raw .ts file. Node's native
 * --experimental-strip-types loader unconditionally refuses to strip types for ANY .ts file
 * located under node_modules (confirmed live, independent of that file's own content), so every
 * consumer of vehicle-client-pi -- even one that never sets options.broker -- was transitively
 * forced to attempt loading that file the moment vehicle-shell.ts loaded at all.
 *
 * The fix: vehicle-shell.ts only ever imports vehicle-shell-broker.ts's TYPES statically (fully
 * erased, no runtime import emitted) and its VALUE lazily, via a dynamic import() inside
 * discoverBrokerVehicles() -- reached only when a consumer's own options.broker is actually set.
 * This test guards the invariant directly against the source text rather than trying to
 * reconstruct a real node_modules-nested install layout just to reproduce Node's own restriction.
 */
describe("vehicle-shell.ts never statically (eagerly) imports vehicle-shell-broker.ts", () => {
	const source = readFileSync(resolve(import.meta.dir, "..", "src", "vehicle-shell.ts"), "utf8");

	it("has no static VALUE import of vehicle-shell-broker.ts", () => {
		// A type-only import (`import type { X } from "./vehicle-shell-broker.js"`) is fully
		// erased at build time -- never a runtime import -- so it's explicitly allowed here.
		const staticValueImport = /^import\s+\{[^}]*\}\s+from\s+["']\.\/vehicle-shell-broker\.js["']/m;
		const staticTypeOnlyImport = /^import\s+type\s+\{[^}]*\}\s+from\s+["']\.\/vehicle-shell-broker\.js["']/m;
		expect(staticTypeOnlyImport.test(source)).toBe(true);
		expect(staticValueImport.test(source)).toBe(false);
	});

	it("loads vehicle-shell-broker.ts's real value (discoverForeignVehicles) only via a dynamic import()", () => {
		expect(source).toContain('await import("./vehicle-shell-broker.js")');
	});
});
