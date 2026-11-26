// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { type FieldValues, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import type { EndpointClusterRef } from "@/domains/endpoint/types";
import {
  checksZCacheRuntime,
  endpointKvCacheConfig,
  setEndpointKvCacheEnabled,
} from "./endpoint-deploy-kv-cache";

const cluster = (type: string, enabled: boolean) =>
  ({
    metadata: { name: "test" },
    spec: { type, cache: { provider: "zcache", options: { enabled } } },
  }) as unknown as EndpointClusterRef;

const cacheForm = (kv_cache: unknown) =>
  renderHook(() =>
    useForm<FieldValues>({ defaultValues: { spec: { kv_cache } } }),
  ).result.current;

describe("checksZCacheRuntime", () => {
  it.each([
    ["a ZCache cluster", true, cluster("kubernetes", true), true],
    ["a cluster without ZCache", true, cluster("kubernetes", false), false],
    ["an SSH cluster", true, cluster("ssh", true), false],
    ["no cluster", true, undefined, false],
    ["a platform without ZCache", false, cluster("kubernetes", true), false],
  ])("%s -> %s", (_, hasZCache, target, expected) => {
    expect(checksZCacheRuntime(hasZCache, target)).toBe(expected);
  });
});

describe("setEndpointKvCacheEnabled", () => {
  it("keeps a typed timeout when enabling", () => {
    const form = cacheForm({ options: { timeout_seconds: 2 } });
    setEndpointKvCacheEnabled(form, true);
    expect(form.getValues("spec.kv_cache")).toEqual({
      provider: "zcache",
      options: { timeout_seconds: 2 },
    });
  });

  it("clears the cache to null when disabling", () => {
    const form = cacheForm({ provider: "zcache", options: {} });
    setEndpointKvCacheEnabled(form, false);
    expect(form.getValues("spec.kv_cache")).toBeNull();
  });
});

describe("endpointKvCacheConfig", () => {
  it("falls back to the default timeout and no cluster", () => {
    const form = cacheForm(null);
    expect(endpointKvCacheConfig(form, { provider: "zcache" })).toEqual({
      timeoutSeconds: 5,
      cluster: null,
    });
  });
});
