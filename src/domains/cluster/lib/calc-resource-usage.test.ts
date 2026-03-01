import { describe, expect, it } from "vitest";
import { calcResourceUsage } from "./calc-resource-usage";

describe("calcResourceUsage", () => {
  it("calculates used and percent", () => {
    expect(calcResourceUsage(100, 80)).toEqual({ used: 20, percent: 20 });
  });

  it("treats undefined available as 0", () => {
    expect(calcResourceUsage(100)).toEqual({ used: 100, percent: 100 });
  });

  it("returns 0 percent when allocatable is 0", () => {
    expect(calcResourceUsage(0, 0)).toEqual({ used: 0, percent: 0 });
  });

  it("rounds percent to nearest integer", () => {
    // 1/3 = 33.33...%
    expect(calcResourceUsage(3, 2)).toEqual({ used: 1, percent: 33 });
  });

  it("handles full usage", () => {
    expect(calcResourceUsage(64, 0)).toEqual({ used: 64, percent: 100 });
  });
});
