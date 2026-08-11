import { describe, expect, it } from "bun:test";
import type { VehiclePresenter } from "../src/vehicle-render.ts";

/**
 * Compile-time proof that `satisfies Record<OperationName, VehiclePresenter>` is genuinely
 * exhaustive-checked by the compiler -- the actual advantage a closed Registry/Strategy has over
 * the generic renderer's own open shape-probing chain, which TypeScript cannot verify covers
 * every real operation at all. Nothing here is a runtime assertion (there is nothing to run --
 * the check IS the compile itself, caught by `tsc --noEmit`, the exact gate this package's own
 * CI/task gates already run); the `expect` call below only exists so this file is a non-empty,
 * real test suite bun:test won't flag as pointless.
 */

type SampleOperationName = "sample.read" | "sample.write" | "sample.delete";

// Positive control: every declared operation name has an assigned presenter -- this line must
// compile cleanly. If it stops compiling, the exhaustiveness guarantee this test exists to prove
// has regressed.
const completePresenters = {
	"sample.read": () => undefined,
	"sample.write": () => undefined,
	"sample.delete": () => undefined,
} satisfies Record<SampleOperationName, VehiclePresenter>;

// Negative control: a deliberately incomplete map (missing "sample.delete") must fail to satisfy
// the type -- @ts-expect-error itself becomes a compile error ("unused directive") if the
// `satisfies` line below ever stops failing, so this is itself the enforcement. TypeScript
// reports a `satisfies` mismatch at the `satisfies` keyword's own line, not the object literal's
// opening brace, so the directive must sit immediately above THAT line, not the assignment.
const incompletePresenters = {
	"sample.read": () => undefined,
	"sample.write": () => undefined,
	// @ts-expect-error -- missing "sample.delete" must be a compile error, not a silent runtime gap
} satisfies Record<SampleOperationName, VehiclePresenter>;

describe("renderPresenters registry: satisfies Record<OperationName, VehiclePresenter> is exhaustive-checked at compile time", () => {
	it("a complete map compiles; an incomplete one is a real compile error (enforced by tsc, not this assertion)", () => {
		expect(Object.keys(completePresenters)).toHaveLength(3);
		expect(Object.keys(incompletePresenters)).toHaveLength(2);
	});
});
