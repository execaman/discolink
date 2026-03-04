import * as val from "../src/Functions/validation";

describe("Functions (validation)", () => {
  describe("isNumber", () => {
    it("returns true for finite numbers", () => {
      expect(val.isNumber(-1)).toBe(true);
      expect(val.isNumber(0)).toBe(true);
      expect(val.isNumber(1.5)).toBe(true);
    });

    it("returns false for invalid inputs", () => {
      expect(val.isNumber("1")).toBe(false);
      expect(val.isNumber(NaN)).toBe(false);
      expect(val.isNumber(Infinity)).toBe(false);
    });

    it("handles known and unknown checks", () => {
      for (let i = -1; i <= 1; i++) {
        expect(val.isNumber(i, "natural")).toBe(i > 0);
        expect(val.isNumber(i, "whole")).toBe(i >= 0);
        expect(val.isNumber(i, "integer")).toBe(true);
      }
      expect(val.isNumber(1.5, "unknown" as any)).toBe(false);
    });
  });

  describe("isString", () => {
    it("returns true for strings", () => {
      expect(val.isString("")).toBe(true);
      expect(val.isString("hello")).toBe(true);
    });

    it("returns false for invalid inputs", () => {
      expect(val.isString(1)).toBe(false);
      expect(val.isString(Symbol())).toBe(false);
    });

    it("handles known and unknown checks", () => {
      expect(val.isString("https://example.com", "url")).toBe(true);
      expect(val.isString("not a url", "url")).toBe(false);
      expect(val.isString("   ", "non-empty")).toBe(false);
      expect(val.isString("  a  ", "non-empty")).toBe(true);
      expect(val.isString("abc123", /^[a-z]+\d+$/)).toBe(true);
      expect(val.isString("123abc", /^[a-z]+\d+$/)).toBe(false);
      expect(val.isString("test", "unknown" as any)).toBe(false);
    });
  });

  describe("isRecord", () => {
    it("returns true for plain objects", () => {
      expect(val.isRecord({})).toBe(true);
      expect(val.isRecord({ a: 1 })).toBe(true);
    });

    it("returns false for invalid inputs", () => {
      expect(val.isRecord([])).toBe(false);
      expect(val.isRecord(null)).toBe(false);
    });

    it("handles known and unknown checks", () => {
      expect(val.isRecord({}, "non-empty")).toBe(false);
      expect(val.isRecord({ a: 1 }, "non-empty")).toBe(true);
      expect(val.isRecord({ a: 1 }, "unknown" as any)).toBe(false);
    });
  });

  describe("isArray", () => {
    it("returns true for arrays", () => {
      expect(val.isArray([])).toBe(true);
      expect(val.isArray([1, 2, 3])).toBe(true);
    });

    it("returns false for invalid inputs", () => {
      expect(val.isArray({})).toBe(false);
      expect(val.isArray(null)).toBe(false);
    });

    it("handles known and unknown checks", () => {
      expect(val.isArray([], "non-empty")).toBe(false);
      expect(val.isArray([1], "non-empty")).toBe(true);
      expect(val.isArray([1, 2, 3], (x) => x > 0)).toBe(true);
      expect(val.isArray([0, 2, 3], (x) => x > 0)).toBe(false);
      expect(val.isArray([1, 2, 3], "unknown" as any)).toBe(false);
    });
  });
});
