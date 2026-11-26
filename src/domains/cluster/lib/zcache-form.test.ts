// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { type FieldValues, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import type { Cluster } from "../types";
import {
  registerZCacheTargetNodes,
  setZCacheEnabled,
  withCacheRetry,
  zcacheDraft,
  zcacheSaveValues,
} from "./zcache-form";

const cacheForm = (options?: Record<string, unknown>) =>
  renderHook(() =>
    useForm<FieldValues>({ defaultValues: { spec: { cache: { options } } } }),
  ).result.current;

describe("zcacheDraft", () => {
  it.each([
    [{ enabled: true, l1_size_gib: 4, target_nodes: ["a", "b"] }, 4, 8],
    [{ enabled: true, l1_size_gib: "", target_nodes: ["a"] }, null, null],
    [{ enabled: true, l1_size_gib: 1.5 }, null, null],
  ])("%o -> capacity %s, total %s", (options, capacity, totalGiB) => {
    expect(zcacheDraft(options)).toMatchObject({ capacity, totalGiB });
  });

  it("reads a missing draft as disabled with no nodes", () => {
    expect(zcacheDraft(undefined)).toEqual({
      enabled: false,
      selected: [],
      capacity: null,
      totalGiB: null,
    });
  });
});

describe("setZCacheEnabled", () => {
  it("completes a draft without a valid capacity with 1 GiB and no nodes", () => {
    const form = cacheForm({ l1_size_gib: "" });
    act(() => setZCacheEnabled(form, true));
    expect(form.getValues("spec.cache")).toEqual({
      provider: "zcache",
      options: { enabled: true, l1_size_gib: 1, target_nodes: [] },
    });
  });

  it("keeps the typed capacity and nodes when turning the cache off", () => {
    const form = cacheForm({
      enabled: true,
      l1_size_gib: 8,
      target_nodes: ["a"],
    });
    act(() => setZCacheEnabled(form, false));
    expect(form.getValues("spec.cache.options")).toEqual({
      enabled: false,
      l1_size_gib: 8,
      target_nodes: ["a"],
    });
  });
});

it.each([
  [true, [], false],
  [true, ["a"], true],
  [false, [], true],
])("enabled %s with nodes %o is valid: %s", async (enabled, nodes, valid) => {
  const form = cacheForm({ enabled, target_nodes: nodes });
  act(() => {
    registerZCacheTargetNodes(form, "pick a node").ref(
      document.createElement("input"),
    );
  });
  let result = false;
  await act(async () => {
    result = await form.trigger("spec.cache.options.target_nodes");
  });
  expect(result).toBe(valid);
});

describe("zcacheSaveValues", () => {
  const cluster = (phase?: string) =>
    ({
      metadata: { name: "c", workspace: "w", annotations: { keep: "1" } },
      spec: {
        type: "kubernetes",
        config: { kubernetes_config: { kubeconfig: "" } },
        cache: { provider: "zcache", options: { enabled: false } },
      },
      status: phase ? { cache: { phase } } : undefined,
    }) as unknown as Cluster;

  it("replaces the cache with the draft and drops a masked kubeconfig", () => {
    expect(
      zcacheSaveValues(cluster(), {
        enabled: true,
        l1_size_gib: "4",
        target_nodes: ["a"],
      }),
    ).toEqual({
      spec: {
        type: "kubernetes",
        config: { kubernetes_config: {} },
        cache: {
          provider: "zcache",
          options: { enabled: true, l1_size_gib: 4, target_nodes: ["a"] },
        },
      },
    });
  });

  it("requests a retry when the cache failed", () => {
    const { metadata } = zcacheSaveValues(cluster("Failed"), undefined);
    expect(metadata?.annotations).toEqual({
      keep: "1",
      "neutree.ai/zcache-retry": expect.any(String),
    });
  });
});

it("issues a fresh retry request each time", () => {
  const metadata = { name: "c", workspace: "w" } as Cluster["metadata"];
  expect(
    withCacheRetry(metadata).annotations["neutree.ai/zcache-retry"],
  ).not.toBe(withCacheRetry(metadata).annotations["neutree.ai/zcache-retry"]);
});
