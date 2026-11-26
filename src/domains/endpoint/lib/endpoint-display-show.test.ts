import { describe, expect, it } from "vitest";
import { makeEndpoint } from "../testing/builders";
import type { Endpoint, EndpointClusterRef } from "../types";
import {
  endpointKVCacheSummary,
  endpointShowQueries,
  engineContainerNames,
  isEndpointInactive,
  rayServeApplicationUrl,
  runtimeCardIdentity,
  shownEngineParameters,
} from "./endpoint-display-show";

const withStatus = (status: Partial<NonNullable<Endpoint["status"]>>) => ({
  ...makeEndpoint(),
  status: status as Endpoint["status"],
});

const zcacheCluster = (enabled: boolean) =>
  ({
    metadata: { name: "gpu cluster" },
    spec: { cache: { provider: "zcache", options: { enabled } } },
  }) as unknown as EndpointClusterRef;

it.each([
  ["Paused", true],
  ["Deleted", true],
  ["Running", false],
])("an endpoint %s is inactive: %s", (phase, expected) => {
  expect(isEndpointInactive(withStatus({ phase } as never))).toBe(expected);
});

describe("endpointShowQueries", () => {
  it("looks up the cluster by name and the endpoints placed on it", () => {
    const queries = endpointShowQueries(makeEndpoint());
    expect(queries.cluster.filters).toEqual([
      { field: "metadata->name", operator: "eq", value: '"cluster-a"' },
    ]);
    expect(queries.clusterEndpoints.filters).toEqual([
      { field: "spec->cluster", operator: "eq", value: '"cluster-a"' },
    ]);
    expect(queries.cluster.meta).toEqual({
      workspace: "default",
      workspaced: true,
    });
  });

  it("waits for the endpoint before any lookup", () => {
    const queries = endpointShowQueries(undefined);
    expect(queries.engine.enabled).toBe(false);
    expect(queries.cluster.enabled).toBe(false);
    expect(queries.clusterEndpoints.enabled).toBe(false);
  });
});

it("opens the Serve application named after the workspace and endpoint", () => {
  expect(rayServeApplicationUrl("/ray", makeEndpoint())).toBe(
    "/ray#/serve/applications/default_chat",
  );
});

describe("shownEngineParameters", () => {
  const endpoint = (provider: string) => ({
    ...withStatus({
      kv_cache: { provider, details: { kv_transfer_config: { k: 1 } } },
    }),
    spec: makeEndpoint({ spec: { variables: { engine_args: { a: 1 } } } }).spec,
  });

  it("adds the transfer config a ZCache provider reports", () => {
    expect(shownEngineParameters(endpoint("zcache"))).toEqual({
      a: 1,
      kv_transfer_config: { k: 1 },
    });
  });

  it("ignores another provider's details", () => {
    expect(shownEngineParameters(endpoint("other"))).toEqual({ a: 1 });
  });
});

it("names a model-free endpoint without a model, in default without a workspace", () => {
  expect(
    runtimeCardIdentity(
      makeEndpoint({
        metadata: { workspace: undefined },
        spec: { model: null },
      }),
    ),
  ).toEqual({ endpointName: "chat", workspace: "default", modelName: "" });
});

it("falls back to the endpoint's engine until engines are listed", () => {
  expect([...engineContainerNames(undefined, makeEndpoint())]).toEqual([
    "vllm",
  ]);
  expect([
    ...engineContainerNames(
      [{ metadata: { name: "sglang" } } as never],
      makeEndpoint(),
    ),
  ]).toEqual(["sglang"]);
});

describe("endpointKVCacheSummary", () => {
  const zcache = { provider: "zcache", options: { timeout_seconds: 2 } };

  it.each([
    ["no cluster", null, undefined],
    ["a cluster without ZCache on", null, zcacheCluster(false)],
    ["another provider", { provider: "other" }, zcacheCluster(true)],
  ])("is hidden with %s", (_case, kv_cache, cluster) => {
    expect(
      endpointKVCacheSummary(makeEndpoint({ spec: { kv_cache } }), cluster),
    ).toBeNull();
  });

  it.each([
    [zcache, true, 2],
    [null, false, 5],
  ])("shows %j as enabled %s with timeout %s", (kv_cache, enabled, timeout) => {
    expect(
      endpointKVCacheSummary(
        makeEndpoint({ spec: { kv_cache } }),
        zcacheCluster(true),
      ),
    ).toEqual({
      enabled,
      timeoutSeconds: timeout,
      clusterName: "gpu cluster",
      clusterCacheHref: "/default/clusters/show/gpu%20cluster?section=cache",
    });
  });
});
