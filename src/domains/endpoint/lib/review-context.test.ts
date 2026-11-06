import { describe, expect, it } from "vitest";
import { capacityExceeded, formatCapacityValue } from "./review-context";

describe("formatCapacityValue", () => {
  it.each([
    { value: 8, shown: "8" },
    { value: 1.5, shown: "1.5" },
    { value: 2.25, shown: "2.3" },
  ])("$value -> $shown", ({ value, shown }) => {
    expect(formatCapacityValue(value)).toBe(shown);
  });
});

describe("capacityExceeded", () => {
  it.each([
    { requested: 3, available: 1, exceeded: true },
    { requested: 2, available: 2, exceeded: false },
    { requested: 3, available: null, exceeded: false },
  ])(
    "$requested requested of $available available -> $exceeded",
    ({ requested, available, exceeded }) => {
      expect(
        capacityExceeded({ key: "cards", requested, available, total: 4 }),
      ).toBe(exceeded);
    },
  );
});
