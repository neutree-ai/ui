import { describe, expect, it } from "vitest";
import {
  displayValueToMs,
  formatTimeout,
  msToDisplayValue,
} from "./convert-timeout";

describe("msToDisplayValue", () => {
  it("converts ms to seconds", () => {
    expect(msToDisplayValue(60000, "s")).toBe(60);
    expect(msToDisplayValue(1000, "s")).toBe(1);
    expect(msToDisplayValue(500, "s")).toBe(0.5);
  });

  it("converts ms to minutes", () => {
    expect(msToDisplayValue(60000, "min")).toBe(1);
    expect(msToDisplayValue(120000, "min")).toBe(2);
    expect(msToDisplayValue(30000, "min")).toBe(0.5);
  });
});

describe("displayValueToMs", () => {
  it("converts seconds to ms", () => {
    expect(displayValueToMs(60, "s")).toBe(60000);
    expect(displayValueToMs(1, "s")).toBe(1000);
    expect(displayValueToMs(0.5, "s")).toBe(500);
  });

  it("converts minutes to ms", () => {
    expect(displayValueToMs(1, "min")).toBe(60000);
    expect(displayValueToMs(2, "min")).toBe(120000);
    expect(displayValueToMs(0.5, "min")).toBe(30000);
  });
});

describe("formatTimeout", () => {
  it("formats exact minutes", () => {
    expect(formatTimeout(60000)).toBe("1min");
    expect(formatTimeout(120000)).toBe("2min");
  });

  it("formats seconds for non-exact minutes", () => {
    expect(formatTimeout(30000)).toBe("30s");
    expect(formatTimeout(1000)).toBe("1s");
    expect(formatTimeout(90000)).toBe("90s");
  });

  it("returns dash for null/undefined/zero", () => {
    expect(formatTimeout(null)).toBe("-");
    expect(formatTimeout(undefined)).toBe("-");
    expect(formatTimeout(0)).toBe("-");
    expect(formatTimeout(-1)).toBe("-");
  });
});
