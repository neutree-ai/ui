import { describe, expect, it } from "vitest";
import { parseContentRangeTotal } from "@/foundation/lib/api/registry-models";

describe("parseContentRangeTotal", () => {
  it("reads the total out of a populated range", () => {
    expect(parseContentRangeTotal("0-1/5")).toBe(5);
    expect(parseContentRangeTotal("2-3/5")).toBe(5);
  });

  it("reads the total of an empty page", () => {
    expect(parseContentRangeTotal("*/0")).toBe(0);
  });

  it("reports an uncountable registry as unknown, not as zero", () => {
    // A public registry cannot say how many models matched. Answering 0 here
    // would tell a caller the listing had ended before it began.
    expect(parseContentRangeTotal("0-1/*")).toBeNull();
    expect(parseContentRangeTotal("*/*")).toBeNull();
  });

  it("treats a missing or unparseable header as unknown", () => {
    expect(parseContentRangeTotal(null)).toBeNull();
    expect(parseContentRangeTotal("")).toBeNull();
    expect(parseContentRangeTotal("0-1")).toBeNull();
    expect(parseContentRangeTotal("0-1/many")).toBeNull();
  });
});
