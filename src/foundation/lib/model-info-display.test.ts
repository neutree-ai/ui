import { describe, expect, it } from "vitest";
import { formatModelInfoNumber } from "./model-info-display";

describe("formatModelInfoNumber", () => {
  it.each([
    ["27781427952", "27.8B"],
    ["262144", "262K"],
    ["1000000", "1M"],
    ["999", "999"],
  ])("formats %s as %s", (value, expected) => {
    expect(formatModelInfoNumber(value)).toBe(expected);
  });

  it.each(["27B", "262k tokens", "unknown", ""])(
    "preserves registry-provided value %j",
    (value) => {
      expect(formatModelInfoNumber(value)).toBe(value);
    },
  );
});
