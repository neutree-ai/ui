import { describe, expect, it } from "vitest";
import { otherGpuReservation } from "./shared-gpu";

describe("otherGpuReservation", () => {
  it.each([
    { physical: 80, own: 56, other: 10, reserved: 10, inconsistent: false },
    { physical: 80, own: 56, other: 24, reserved: 24, inconsistent: false },
    { physical: 45, own: 45, other: 22, reserved: 0, inconsistent: true },
    { physical: null, own: 45, other: 22, reserved: 22, inconsistent: false },
    { physical: 0, own: 45, other: 22, reserved: 22, inconsistent: false },
  ])(
    "$own + $other MiB on $physical MiB -> inconsistent: $inconsistent",
    ({ physical, own, other, reserved, inconsistent }) => {
      expect(otherGpuReservation(physical, own, other)).toEqual({
        reservedMiB: reserved,
        inconsistent,
      });
    },
  );
});
