import { describe, expect, it } from "bun:test";
import { assertNoLeadingFlagChar, UnsafeCliArgument } from "../../src/cli-safety/assert-no-leading-flag-char.js";

describe("assertNoLeadingFlagChar", () => {
	it("accepts a plain literal value", () => {
		expect(() => assertNoLeadingFlagChar("main")).not.toThrow();
	});

	it("accepts a value containing a dash that is not a leading char", () => {
		expect(() => assertNoLeadingFlagChar("feature/my-branch")).not.toThrow();
	});

	it("accepts an empty string -- no leading char to be a flag at all", () => {
		expect(() => assertNoLeadingFlagChar("")).not.toThrow();
	});

	it("rejects a value starting with a single dash", () => {
		expect(() => assertNoLeadingFlagChar("-x")).toThrow(UnsafeCliArgument);
	});

	it("rejects a value starting with a double dash", () => {
		expect(() => assertNoLeadingFlagChar("--upload-pack=evil")).toThrow(UnsafeCliArgument);
	});

	it("rejects a bare single dash", () => {
		expect(() => assertNoLeadingFlagChar("-")).toThrow(UnsafeCliArgument);
	});

	it("thrown error carries the offending value", () => {
		try {
			assertNoLeadingFlagChar("--exec=rm -rf /");
			throw new Error("expected assertNoLeadingFlagChar to throw");
		} catch (error) {
			expect(error).toBeInstanceOf(UnsafeCliArgument);
			expect((error as UnsafeCliArgument).value).toBe("--exec=rm -rf /");
		}
	});

	it("names the field in the message when fieldName is given", () => {
		try {
			assertNoLeadingFlagChar("-c", "ref");
			throw new Error("expected assertNoLeadingFlagChar to throw");
		} catch (error) {
			expect(error).toBeInstanceOf(UnsafeCliArgument);
			expect((error as UnsafeCliArgument).fieldName).toBe("ref");
			expect((error as Error).message).toContain("ref");
		}
	});

	it("omits any field reference in the message when fieldName is not given", () => {
		try {
			assertNoLeadingFlagChar("-c");
			throw new Error("expected assertNoLeadingFlagChar to throw");
		} catch (error) {
			expect(error).toBeInstanceOf(UnsafeCliArgument);
			expect((error as UnsafeCliArgument).fieldName).toBeUndefined();
			expect((error as Error).message).toBe('"-c" cannot be used as a CLI argument -- it would be interpreted as a flag, not a literal value');
		}
	});
});
