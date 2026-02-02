import { isArray, isNumber, isRecord, isString } from "../../src/Functions/validation";

describe("isArray", () => {
  test.each([null, {}])("must return false for %p (check: none)", (input) => {
    expect(isArray(input)).toBe(false);
  });

  it("must return true for [] (check: none)", () => {
    expect(isArray([])).toBe(true);
  });

  it("must return false for [] (check: non-empty)", () => {
    expect(isArray([], "non-empty")).toBe(false);
  });

  it("must return true for [NaN] (check: Number.isNaN)", () => {
    expect(isArray([Number.NaN], Number.isNaN)).toBe(true);
  });

  it("must return false for [NaN, 1] (check: Number.isNaN)", () => {
    expect(isArray([Number.NaN, 1], Number.isNaN)).toBe(false);
  });

  it("must return false for [] (check: unknown)", () => {
    expect(isArray([], "unknown" as any)).toBe(false);
  });
});

describe("isNumber", () => {
  test.each([Number.NaN, Number.POSITIVE_INFINITY])("must return false for %p (check: none)", (input) => {
    expect(isNumber(input)).toBe(false);
  });

  test.each(["integer", "natural", "whole"])("must return true for 1 (check: %p)", (check) => {
    expect(isNumber(1, check as any)).toBe(true);
  });

  test.each(["integer", "natural", "whole"])("must return false for 1.1 (check: %p)", (check) => {
    expect(isNumber(1.1, check as any)).toBe(false);
  });

  test.each(["integer", "whole"])("must return true for 0 (check: %p)", (check) => {
    expect(isNumber(0, check as any)).toBe(true);
  });

  it("must return false for 0 (check: natural)", () => {
    expect(isNumber(0, "natural")).toBe(false);
  });

  test.each(["natural", "whole"])("must return false for -1 (check: %p)", (check) => {
    expect(isNumber(-1, check as any)).toBe(false);
  });

  it("must return true for -1 (check: integer)", () => {
    expect(isNumber(-1, "integer")).toBe(true);
  });

  it("must return false for 1 (check: unknown)", () => {
    expect(isNumber(1, "unknown" as any)).toBe(false);
  });
});

describe("isRecord", () => {
  test.each([null, []])("must return false for %p (check: none)", (input) => {
    expect(isRecord(input)).toBe(false);
  });

  it("must return true for {} (check: none)", () => {
    expect(isRecord({})).toBe(true);
  });

  it("must return false for {} (check: non-empty)", () => {
    expect(isRecord({}, "non-empty")).toBe(false);
  });

  it("must return false for {} (check: unknown)", () => {
    expect(isRecord({}, "unknown" as any)).toBe(false);
  });
});

describe("isString", () => {
  it("must return true for 'hello' (check: none)", () => {
    expect(isString("hello")).toBe(true);
  });

  it("must return false for symbol (check: none)", () => {
    expect(isString(Symbol())).toBe(false);
  });

  it("must return false for ' ' (check: non-empty)", () => {
    expect(isString(" ", "non-empty")).toBe(false);
  });

  it("must return true for 'https://example.com' (check: url)", () => {
    expect(isString("https://example.com", "url")).toBe(true);
  });

  it("must return true for 'hello' (check: /^h/)", () => {
    expect(isString("hello", /^h/)).toBe(true);
  });

  it("must return false for 'hello' (check: unknown)", () => {
    expect(isString("hello", "unknown" as any)).toBe(false);
  });
});
