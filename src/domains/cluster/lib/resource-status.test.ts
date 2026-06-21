import { describe, expect, it } from "vitest";
import { getAcceleratorProductQuantities } from "./resource-status";

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
