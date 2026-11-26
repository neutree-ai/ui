import { describe, expect, it } from "vitest";
import type { ResourceStatus } from "@/foundation/types/resource-types";
import {
  acceleratorCardCounts,
  getAcceleratorProductQuantities,
  nodeHasAccelerators,
} from "./resource-status";

const groups = (quantities: Record<string, number>) =>
  Object.fromEntries(
    Object.entries(quantities).map(([type, quantity]) => [
      type,
      { quantity, products: null, product_groups: null },
    ]),
  );
const status = (
  allocatable: Record<string, number>,
  available?: Record<string, number>,
) =>
  ({
    allocatable: {
      cpu: 8,
      memory: 32,
      accelerator_groups: groups(allocatable),
    },
    available: available
      ? { cpu: 8, memory: 32, accelerator_groups: groups(available) }
      : null,
  }) as ResourceStatus;

describe("cluster resource status helpers", () => {
  it("derives accelerator product quantities from products when product_groups is absent", () => {
    expect(
      getAcceleratorProductQuantities({
        quantity: 2,
        product_groups: null,
        products: {
          "Tesla-T4": {
            quantity: 2,
            virtualization: {
              memory_mib: 30720,
              core_units: 200,
            },
          },
        },
      }),
    ).toEqual({ "Tesla-T4": 2 });
  });
});

describe("nodeHasAccelerators", () => {
  it("counts a positive group without devices", () => {
    expect(nodeHasAccelerators(status({ nvidia_gpu: 2 }))).toBe(true);
    expect(nodeHasAccelerators(status({ nvidia_gpu: 0 }))).toBe(false);
  });
});

describe("acceleratorCardCounts", () => {
  it("sums whole cards and the available ones", () => {
    expect(
      acceleratorCardCounts(status({ a: 2, b: 4 }, { a: 1, b: 4 })),
    ).toEqual({ total: 6, available: 5, discrete: true });
  });

  it("leaves availability unknown when a type is missing from it", () => {
    expect(acceleratorCardCounts(status({ a: 2, b: 4 }, { a: 1 }))).toEqual({
      total: 6,
      available: null,
      discrete: true,
    });
  });

  it("uses a continuous meter for fractional quantities", () => {
    expect(acceleratorCardCounts(status({ a: 2 }, { a: 0.5 })).discrete).toBe(
      false,
    );
  });
});
