import { describe, expect, it } from "vitest";
import type { EndpointClusterRef } from "@/domains/endpoint/types";
import {
  gpuCountStep,
  summarizeResourcePool,
} from "./endpoint-deploy-resources";

it.each([
  ["ssh", 0.1],
  ["kubernetes", 1],
])("gpuCountStep on %s -> %s", (type, step) => {
  expect(gpuCountStep({ spec: { type } } as EndpointClusterRef)).toBe(step);
});

describe("summarizeResourcePool", () => {
  const pool = (allocatable: number, available: number) =>
    ({
      allocatable: { cpu: allocatable },
      available: { cpu: available },
    }) as never;

  it("derives used and percent from total and available", () => {
    expect(summarizeResourcePool(pool(8, 2), "cpu")).toEqual({
      total: 8,
      available: 2,
      used: 6,
      percent: 75,
    });
  });

  it("never reports negative use", () => {
    expect(summarizeResourcePool(pool(4, 6), "cpu").used).toBe(0);
  });

  it("leaves used unknown when a side is not reported", () => {
    expect(summarizeResourcePool(undefined, "memory")).toEqual({
      total: null,
      available: null,
      used: null,
      percent: 0,
    });
  });
});
