import { describe, expect, it } from "vitest";
import { formatMaxLength } from "./MaxLengthSelector";

describe("formatMaxLength", () => {
  // Below 1K plain; whole K/M without decimals, the rest with two.
  it.each([
    [0, "0"],
    [1023, "1023"],
    [1024, "1K"],
    [1023 * 1024, "1023K"],
    [1024 + 512, "1.50K"],
    [1500, "1.46K"],
    [1024 * 1024, "1M"],
    [2 * 1024 * 1024, "2M"],
    [1024 * 1024 + 512 * 1024, "1.50M"],
  ])("formats %d as %s", (value, shown) => {
    expect(formatMaxLength(value)).toBe(shown);
  });
});
