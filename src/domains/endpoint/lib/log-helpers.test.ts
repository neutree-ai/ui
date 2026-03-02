import { describe, expect, it } from "vitest";
import { filterByTimestamp } from "./log-helpers";

describe("filterByTimestamp", () => {
  it("includes lines without a timestamp", () => {
    expect(filterByTimestamp("plain log line with no date")).toBe(true);
  });

  it("includes a timestamp within the range", () => {
    const line = "2024-01-15T10:30:00 INFO something";
    expect(
      filterByTimestamp(line, "2024-01-15T10:00:00", "2024-01-15T11:00:00"),
    ).toBe(true);
  });

  it("excludes a timestamp before startTime", () => {
    const line = "2024-01-15T09:00:00 INFO too early";
    expect(filterByTimestamp(line, "2024-01-15T10:00:00")).toBe(false);
  });

  it("excludes a timestamp after endTime", () => {
    const line = "2024-01-15T12:00:00 INFO too late";
    expect(filterByTimestamp(line, undefined, "2024-01-15T11:00:00")).toBe(
      false,
    );
  });

  it("includes when only startTime is set and timestamp is after it", () => {
    const line = "2024-01-15T11:00:00 INFO ok";
    expect(filterByTimestamp(line, "2024-01-15T10:00:00")).toBe(true);
  });

  it("includes when only endTime is set and timestamp is before it", () => {
    const line = "2024-01-15T09:00:00 INFO ok";
    expect(filterByTimestamp(line, undefined, "2024-01-15T10:00:00")).toBe(
      true,
    );
  });

  it("includes lines with unparseable dates", () => {
    // The regex matches but Date.parse returns NaN
    const line = "9999-99-99T99:99:99 broken";
    expect(filterByTimestamp(line, "2024-01-01T00:00:00")).toBe(true);
  });

  it("handles ISO format timestamps (T separator)", () => {
    const line = "2024-01-15T10:30:00 INFO iso";
    expect(
      filterByTimestamp(line, "2024-01-15T10:00:00", "2024-01-15T11:00:00"),
    ).toBe(true);
  });

  it("handles space-separated timestamps", () => {
    const line = "2024-01-15 10:30:00 INFO space";
    expect(
      filterByTimestamp(line, "2024-01-15T10:00:00", "2024-01-15T11:00:00"),
    ).toBe(true);
  });

  it("includes when no time boundaries are provided", () => {
    const line = "2024-01-15T10:30:00 INFO no bounds";
    expect(filterByTimestamp(line)).toBe(true);
  });
});
