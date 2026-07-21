import { describe, expect, it } from "vitest";
import {
  formatThousands,
  formatTokenQuota,
  isValidTokenQuota,
  parseTokenAmount,
  splitTokenQuota,
  toTokenCount,
} from "./token-quota";

describe("formatThousands", () => {
  it("groups the integer part", () => {
    expect(formatThousands("10000")).toBe("10,000");
    expect(formatThousands("1234567")).toBe("1,234,567");
  });

  it("regroups already-grouped input", () => {
    expect(formatThousands("1,0000")).toBe("10,000");
  });

  it("preserves what is mid-typing", () => {
    expect(formatThousands("")).toBe("");
    expect(formatThousands("1500.")).toBe("1,500.");
    expect(formatThousands("1500.50")).toBe("1,500.50");
    expect(formatThousands(".5")).toBe(".5");
  });

  it("passes non-numeric input through for the validator to reject", () => {
    expect(formatThousands("abc")).toBe("abc");
    expect(formatThousands("1.2.3")).toBe("1.2.3");
  });
});

describe("parseTokenAmount", () => {
  it("strips separators", () => {
    expect(parseTokenAmount("1,234,567")).toBe(1234567);
    expect(parseTokenAmount(" 1.5 ")).toBe(1.5);
  });

  it("returns null for empty or non-numeric input", () => {
    expect(parseTokenAmount("")).toBeNull();
    expect(parseTokenAmount("abc")).toBeNull();
    expect(parseTokenAmount("-5")).toBeNull();
    expect(parseTokenAmount("1.2.3")).toBeNull();
  });
});

describe("toTokenCount", () => {
  it("multiplies amount by unit", () => {
    expect(toTokenCount("200", "M")).toBe(200_000_000);
    expect(toTokenCount("1.5", "M")).toBe(1_500_000);
    expect(toTokenCount("2", "B")).toBe(2_000_000_000);
    expect(toTokenCount("12,345", "tokens")).toBe(12345);
  });

  it("absorbs floating-point drift", () => {
    // 1.1 * 1000 is 1100.0000000000002 in IEEE-754.
    expect(toTokenCount("1.1", "K")).toBe(1100);
  });

  it("rejects products that are not positive integers", () => {
    expect(toTokenCount("1.5", "tokens")).toBeNull();
    expect(toTokenCount("0.0001", "K")).toBeNull();
    expect(toTokenCount("0", "M")).toBeNull();
    expect(toTokenCount("", "M")).toBeNull();
    expect(toTokenCount("abc", "M")).toBeNull();
  });

  it("rejects values beyond safe-integer range", () => {
    expect(toTokenCount("99999999", "B")).toBeNull();
  });
});

describe("isValidTokenQuota", () => {
  it("treats empty as unset", () => {
    expect(isValidTokenQuota("", "M")).toBe(true);
    expect(isValidTokenQuota("   ", "tokens")).toBe(true);
  });

  it("accepts decimals that resolve to whole tokens", () => {
    expect(isValidTokenQuota("1.5", "M")).toBe(true);
  });

  it("rejects fractional token counts", () => {
    expect(isValidTokenQuota("1.5", "tokens")).toBe(false);
    expect(isValidTokenQuota("0", "M")).toBe(false);
  });
});

describe("splitTokenQuota", () => {
  it("picks the largest exactly-dividing unit", () => {
    expect(splitTokenQuota(200_000_000)).toEqual({ amount: 200, unit: "M" });
    expect(splitTokenQuota(2_000_000_000)).toEqual({ amount: 2, unit: "B" });
    expect(splitTokenQuota(10_000)).toEqual({ amount: 10, unit: "K" });
  });

  it("falls back to raw tokens when nothing divides evenly", () => {
    expect(splitTokenQuota(12_345)).toEqual({ amount: 12345, unit: "tokens" });
    expect(splitTokenQuota(1)).toEqual({ amount: 1, unit: "tokens" });
  });

  it("returns the value as-is for non-finite or non-positive input", () => {
    expect(splitTokenQuota(0)).toEqual({ amount: 0, unit: "tokens" });
    expect(splitTokenQuota(-100)).toEqual({ amount: -100, unit: "tokens" });
    expect(splitTokenQuota(Number.NaN)).toEqual({
      amount: Number.NaN,
      unit: "tokens",
    });
  });

  it("round-trips through toTokenCount without losing precision", () => {
    for (const n of [1, 999, 12_345, 10_000, 1_500_000, 200_000_000]) {
      const { amount, unit } = splitTokenQuota(n);
      expect(toTokenCount(String(amount), unit)).toBe(n);
    }
  });
});

describe("formatTokenQuota", () => {
  it("uses the unit when the value divides evenly", () => {
    expect(formatTokenQuota(1_000_000)).toBe("1M");
    expect(formatTokenQuota(200_000_000)).toBe("200M");
    expect(formatTokenQuota(2_000_000_000)).toBe("2B");
    expect(formatTokenQuota(10_000)).toBe("10K");
  });

  it("shows a grouped integer otherwise", () => {
    expect(formatTokenQuota(1_234_123)).toBe("1,234,123");
    expect(formatTokenQuota(0)).toBe("0");
  });

  it("handles negatives and nullish input", () => {
    expect(formatTokenQuota(-500)).toBe("-500");
    expect(formatTokenQuota(null)).toBe("");
    expect(formatTokenQuota(undefined)).toBe("");
  });
});
