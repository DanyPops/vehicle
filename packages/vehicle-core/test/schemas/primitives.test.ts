import { describe, expect, it } from "bun:test";
import {
	isNonEmptyString,
	isNonNegativeSafeInteger,
	isPlainObject,
	isPositiveSafeInteger,
	isSafeInteger,
	isStringArray,
	notAnObjectIssue,
	schemaIssue,
} from "../../src/schemas/primitives.ts";

describe("notAnObjectIssue", () => {
	it("returns the standard 'input must be an object' failure", () => {
		expect(notAnObjectIssue()).toEqual({ success: false, issues: [{ path: [], message: "input must be an object" }] });
	});
});

describe("schemaIssue", () => {
	it("wraps a single string key into a one-element path", () => {
		expect(schemaIssue("workspaceId", "workspaceId must be a non-empty string")).toEqual({
			success: false,
			issues: [{ path: ["workspaceId"], message: "workspaceId must be a non-empty string" }],
		});
	});

	it("wraps a single numeric key into a one-element path", () => {
		expect(schemaIssue(0, "must be a string")).toEqual({ success: false, issues: [{ path: [0], message: "must be a string" }] });
	});

	it("passes a full path segment array through unchanged", () => {
		expect(schemaIssue(["anchors", 2, "line"], "line must be a positive integer")).toEqual({
			success: false,
			issues: [{ path: ["anchors", 2, "line"], message: "line must be a positive integer" }],
		});
	});
});

describe("isPlainObject", () => {
	it("is true for a real object", () => {
		expect(isPlainObject({})).toBe(true);
		expect(isPlainObject({ a: 1 })).toBe(true);
	});

	it("is false for null, an array, and non-object primitives", () => {
		expect(isPlainObject(null)).toBe(false);
		expect(isPlainObject([])).toBe(false);
		expect(isPlainObject("x")).toBe(false);
		expect(isPlainObject(1)).toBe(false);
		expect(isPlainObject(undefined)).toBe(false);
	});
});

describe("isNonEmptyString", () => {
	it("is true for a non-empty string", () => {
		expect(isNonEmptyString("a")).toBe(true);
	});

	it("is false for an empty string and for non-strings", () => {
		expect(isNonEmptyString("")).toBe(false);
		expect(isNonEmptyString(1)).toBe(false);
		expect(isNonEmptyString(null)).toBe(false);
		expect(isNonEmptyString(undefined)).toBe(false);
	});
});

describe("isSafeInteger", () => {
	it("is true for a real safe integer, including zero and negatives", () => {
		expect(isSafeInteger(0)).toBe(true);
		expect(isSafeInteger(-5)).toBe(true);
		expect(isSafeInteger(42)).toBe(true);
	});

	it("is false for a fractional number, NaN, Infinity, and non-numbers", () => {
		expect(isSafeInteger(1.5)).toBe(false);
		expect(isSafeInteger(Number.NaN)).toBe(false);
		expect(isSafeInteger(Number.POSITIVE_INFINITY)).toBe(false);
		expect(isSafeInteger("1")).toBe(false);
	});
});

describe("isNonNegativeSafeInteger", () => {
	it("accepts zero and positive integers", () => {
		expect(isNonNegativeSafeInteger(0)).toBe(true);
		expect(isNonNegativeSafeInteger(5)).toBe(true);
	});

	it("rejects negative integers", () => {
		expect(isNonNegativeSafeInteger(-1)).toBe(false);
	});
});

describe("isPositiveSafeInteger", () => {
	it("accepts a positive integer with no maximum given", () => {
		expect(isPositiveSafeInteger(1)).toBe(true);
		expect(isPositiveSafeInteger(1000)).toBe(true);
	});

	it("rejects zero and negative integers", () => {
		expect(isPositiveSafeInteger(0)).toBe(false);
		expect(isPositiveSafeInteger(-1)).toBe(false);
	});

	it("enforces an inclusive maximum when given", () => {
		expect(isPositiveSafeInteger(10, 10)).toBe(true);
		expect(isPositiveSafeInteger(11, 10)).toBe(false);
		expect(isPositiveSafeInteger(1, 10)).toBe(true);
	});
});

describe("isStringArray", () => {
	it("accepts an array of strings, including an empty array", () => {
		expect(isStringArray([])).toBe(true);
		expect(isStringArray(["a", "b"])).toBe(true);
	});

	it("rejects a non-array and an array with any non-string element", () => {
		expect(isStringArray("a")).toBe(false);
		expect(isStringArray(["a", 1])).toBe(false);
		expect(isStringArray([1, 2])).toBe(false);
	});
});
