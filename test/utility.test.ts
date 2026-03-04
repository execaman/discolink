import * as util from "../src/Functions/utility";

describe("Functions (utility)", () => {
  describe("noop", () => {
    it("returns undefined", () => {
      expect(util.noop()).toBeUndefined();
    });
  });

  describe("formatDuration", () => {
    it("handles invalid inputs", () => {
      expect(util.formatDuration(NaN)).toBe("00:00");
      expect(util.formatDuration(Infinity)).toBe("00:00");
      expect(util.formatDuration(-1000)).toBe("00:00");
      expect(util.formatDuration("1000" as any)).toBe("00:00");
    });

    it("formats duration correctly", () => {
      expect(util.formatDuration(9_000)).toBe("00:09");
      expect(util.formatDuration(59_000)).toBe("00:59");
      expect(util.formatDuration(3_600_000)).toBe("01:00:00");
      expect(util.formatDuration(90_000_000)).toBe("25:00:00");
    });
  });
});
