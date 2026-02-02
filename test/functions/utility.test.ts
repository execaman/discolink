import { noop, formatDuration } from "../../src/Functions/utility";

describe("noop", () => {
  it("should not return anything", () => {
    expect(noop()).toBeUndefined();
  });
});

describe("formatDuration", () => {
  test.each([Number.NaN, Number.POSITIVE_INFINITY])("must return 00:00 for %p", (input) => {
    expect(formatDuration(input)).toBe("00:00");
  });

  it("must return 01:00 for 60_000 ms", () => {
    expect(formatDuration(60_000)).toBe("01:00");
  });

  it("must return 01:00:00 for 3600_000 ms", () => {
    expect(formatDuration(3600_000)).toBe("01:00:00");
  });

  it("must return 25:00:00 for 90_000_000 ms", () => {
    expect(formatDuration(90_000_000)).toBe("25:00:00");
  });
});
