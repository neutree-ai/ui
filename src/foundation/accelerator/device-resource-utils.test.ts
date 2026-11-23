import { describe, expect, it } from "vitest";
import {
  compareDevicesByOrderThenUuid,
  getDeviceOrder,
  mergePoolTotals,
} from "./device-resource-utils";

const emptyPool = { total: null, available: null };

describe("mergePoolTotals", () => {
  it("keeps null when the running total and the next value are both null", () => {
    expect(mergePoolTotals(emptyPool, null, null)).toEqual({
      total: null,
      available: null,
    });
  });

  it("keeps null when the next value is undefined", () => {
    expect(mergePoolTotals(emptyPool, undefined, undefined)).toEqual({
      total: null,
      available: null,
    });
  });

  it("treats a null running total as zero once a real value arrives", () => {
    expect(mergePoolTotals(emptyPool, 8192, 4096)).toEqual({
      total: 8192,
      available: 4096,
    });
  });

  it("sums into an existing running total", () => {
    expect(
      mergePoolTotals({ total: 8192, available: 4096 }, 2048, 1024),
    ).toEqual({ total: 10240, available: 5120 });
  });

  it("treats a null next value as zero when a running total exists", () => {
    expect(
      mergePoolTotals({ total: 8192, available: 4096 }, null, null),
    ).toEqual({ total: 8192, available: 4096 });
  });

  it("tracks total and available independently", () => {
    expect(
      mergePoolTotals({ total: 8192, available: null }, null, 512),
    ).toEqual({ total: 8192, available: 512 });
  });
});

describe("getDeviceOrder", () => {
  it("returns finite numbers as-is, including zero", () => {
    expect(getDeviceOrder(0)).toBe(0);
    expect(getDeviceOrder(3)).toBe(3);
  });

  it("returns null for null, undefined, and non-finite values", () => {
    expect(getDeviceOrder(null)).toBeNull();
    expect(getDeviceOrder(undefined)).toBeNull();
    expect(getDeviceOrder(Number.NaN)).toBeNull();
    expect(getDeviceOrder(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("compareDevicesByOrderThenUuid", () => {
  const sort = (devices: { order?: number | null; uuid: string }[]) =>
    [...devices].sort(compareDevicesByOrderThenUuid).map((d) => d.uuid);

  it("sorts by order when both orders are present", () => {
    expect(
      sort([
        { order: 2, uuid: "c" },
        { order: 0, uuid: "a" },
        { order: 1, uuid: "b" },
      ]),
    ).toEqual(["a", "b", "c"]);
  });

  it("falls back to uuid when orders are equal", () => {
    expect(
      sort([
        { order: 1, uuid: "b" },
        { order: 1, uuid: "a" },
      ]),
    ).toEqual(["a", "b"]);
  });

  it("places devices without an order last", () => {
    expect(
      sort([
        { uuid: "no-order" },
        { order: 1, uuid: "b" },
        { order: null, uuid: "also-no-order" },
        { order: 0, uuid: "a" },
      ]),
    ).toEqual(["a", "b", "also-no-order", "no-order"]);
  });

  it("sorts unordered devices among themselves by uuid", () => {
    expect(sort([{ uuid: "z" }, { uuid: "a" }])).toEqual(["a", "z"]);
  });
});
