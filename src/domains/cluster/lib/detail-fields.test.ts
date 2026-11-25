import { describe, expect, it } from "vitest";
import type { Cluster } from "@/domains/cluster/types";
import { fieldKeys } from "@/foundation/testing/detail-fields";
import { clusterHeaderFields } from "./detail-fields";

describe("clusterHeaderFields", () => {
  it.each([
    { type: "kubernetes", shown: true },
    { type: "ssh", shown: false },
  ])("lists accelerator virtualization on $type: $shown", ({ type, shown }) => {
    const keys = fieldKeys(clusterHeaderFields({ spec: { type } } as Cluster));

    expect(keys.includes("acceleratorVirtualization")).toBe(shown);
  });
});
