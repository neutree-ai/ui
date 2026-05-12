import { describe, expect, it } from "vitest";
import { formatMaxLength } from "./MaxLengthSelector";

describe("formatMaxLength", () => {
  it("formats sub-1K values as plain numbers", () => {
    expect(formatMaxLength(0)).toBe("0");
    expect(formatMaxLength(1)).toBe("1");
    expect(formatMaxLength(1023)).toBe("1023");
  });

  it("formats integer K values without decimals", () => {
    expect(formatMaxLength(1024)).toBe("1K");
    expect(formatMaxLength(64 * 1024)).toBe("64K");
    expect(formatMaxLength(1023 * 1024)).toBe("1023K");
  });

  it("formats non-integer K values with two decimals", () => {
    expect(formatMaxLength(1024 + 512)).toBe("1.50K");
    expect(formatMaxLength(1500)).toBe("1.46K");
  });

  it("formats integer M values without decimals", () => {
    expect(formatMaxLength(1024 * 1024)).toBe("1M");
    expect(formatMaxLength(2 * 1024 * 1024)).toBe("2M");
  });

  it("formats non-integer M values with two decimals", () => {
    expect(formatMaxLength(1024 * 1024 + 512 * 1024)).toBe("1.50M");
  });
});
