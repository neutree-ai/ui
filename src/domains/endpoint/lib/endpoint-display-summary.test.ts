import { describe, expect, it } from "vitest";
import { makeEndpoint } from "../testing/builders";
import type { ResourceSpec } from "../types";
import {
  endpointConfigurationSummary,
  kvCacheTimeoutSeconds,
  replicaCount,
  requestedReplicas,
  requestedResourcesView,
} from "./endpoint-display-summary";

const t = (key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${Object.values(options).join(",")}` : key;

const vgpu = (virtualization: Record<string, number>) =>
  ({
    cpu: 2,
    memory: 8,
    gpu: 1,
    accelerator: { type: "nvidia_gpu", product: "Tesla-T4", virtualization },
  }) as ResourceSpec;

describe("replica counts", () => {
  it.each([
    [null, 1, 1],
    [{ num: 0 }, 0, 1],
    [{ num: "3" as unknown as number }, "3", 3],
  ])(
    "shows %j as stored %j and requested %j",
    (replicas, stored, requested) => {
      expect(replicaCount(replicas)).toBe(stored);
      expect(requestedReplicas(replicas)).toBe(requested);
    },
  );
});

it("defaults the KV cache timeout to five seconds", () => {
  expect(kvCacheTimeoutSeconds({ provider: "zcache" })).toBe(5);
  expect(
    kvCacheTimeoutSeconds({
      provider: "zcache",
      options: { timeout_seconds: 2 },
    }),
  ).toBe(2);
});

describe("endpointConfigurationSummary", () => {
  const values = (rows: { label: string; value: string }[]) =>
    Object.fromEntries(rows.map((row) => [row.label, row.value]));

  it("names what deployment picks for an unset model version and file", () => {
    const { model } = endpointConfigurationSummary(makeEndpoint().spec, t);
    expect(values(model)).toMatchObject({
      "endpoints.fields.modelVersion":
        "endpoints.wizard.summary.versionResolvedAtDeployment",
      "endpoints.fields.modelFile":
        "endpoints.wizard.summary.fileDefaultEntryPoint",
    });
  });

  it("shows the vGPU limits only when set", () => {
    const labels = (resources: ResourceSpec) =>
      endpointConfigurationSummary(
        makeEndpoint({ spec: { resources } }).spec,
        t,
      ).resources.map((row) => row.label);
    expect(labels(makeEndpoint().spec.resources as ResourceSpec)).toEqual([
      "endpoints.fields.accelerator",
      "endpoints.wizard.summary.resourceRequest",
    ]);
    expect(labels(vgpu({ memory_mib: 16384, core_percent: 50 }))).toContain(
      "endpoints.fields.vgpuCoreLimit",
    );
  });

  it("reports a disabled cache without a provider", () => {
    const { runtime } = endpointConfigurationSummary(makeEndpoint().spec, t);
    expect(values(runtime)["endpoints.wizard.summary.cache"]).toBe(
      "endpoints.wizard.summary.cacheDisabled",
    );
  });
});

describe("requestedResourcesView", () => {
  it("shows the core percent as a whole number, and none when unset", () => {
    expect(
      requestedResourcesView(vgpu({ memory_mib: 8192, core_percent: 50 })).vgpu,
    ).toEqual({ memory: "8.0 GiB", corePercent: "50" });
    expect(
      requestedResourcesView(vgpu({ memory_mib: 8192 })).vgpu?.corePercent,
    ).toBeNull();
  });

  it("shows an accelerator only with both type and product", () => {
    const resources = vgpu({});
    expect(requestedResourcesView(resources).accelerator).toEqual({
      type: "nvidia_gpu",
      product: "Tesla-T4",
    });
    expect(
      requestedResourcesView({
        ...resources,
        accelerator: { type: "nvidia_gpu", product: "" },
      }).accelerator,
    ).toBeNull();
  });

  it.each([
    [1, true],
    [0, false],
    [null, false],
  ])("a GPU count of %j requests a GPU: %s", (gpu, expected) => {
    expect(requestedResourcesView({ ...vgpu({}), gpu }).requestsGpu).toBe(
      expected,
    );
  });
});
