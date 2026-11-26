import { describe, expect, it } from "vitest";
import type { Cluster } from "@/domains/cluster/types";
import { fieldKeys } from "@/foundation/testing/detail-fields";
import { clusterHeaderFields, modelCacheTitle } from "./detail-fields";

describe("clusterHeaderFields", () => {
  it.each([
    { type: "kubernetes", shown: true },
    { type: "ssh", shown: false },
  ])("lists accelerator virtualization on $type: $shown", ({ type, shown }) => {
    const keys = fieldKeys(clusterHeaderFields({ spec: { type } } as Cluster));

    expect(keys.includes("acceleratorVirtualization")).toBe(shown);
  });
});

describe("modelCacheTitle", () => {
  const t = ((key: string) => key) as never;

  it("is the cache's name, else its storage kind", () => {
    expect(
      modelCacheTitle({ name: "models", host_path: { path: "/m" } }, t),
    ).toBe("models");
    expect(
      modelCacheTitle({ name: "", nfs: { server: "s", path: "/m" } }, t),
    ).toBe("clusters.fields.modelCache.type.nfs");
  });
});
