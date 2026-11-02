import { describe, expect, it } from "vitest";
import type { EndpointClusterRef } from "@/domains/endpoint/types";
import { readEndpointCacheManagerStatus } from "./cache-manager-status";

const cluster = (
  status: EndpointClusterRef["status"],
  cacheEnabled = true,
): EndpointClusterRef => ({
  metadata: {
    name: "cache-cluster",
    workspace: "default",
    deletion_timestamp: null,
    creation_timestamp: "",
    update_timestamp: "",
    labels: {},
    annotations: {},
  },
  spec: {
    type: "kubernetes",
    cache: {
      provider: "zcache",
      options: {
        enabled: cacheEnabled,
        version: "v0.5.6-post.1",
        l1_size_gib: 8,
      },
    },
  },
  status,
});

describe("readEndpointCacheManagerStatus", () => {
  it("reports ready state and the L1 capacity from cluster status", () => {
    expect(
      readEndpointCacheManagerStatus(
        cluster({
          cache: {
            phase: "Ready",
            conditions: [
              {
                type: "Ready",
                status: "True",
                reason: "Ready",
                message: "cache runtime is healthy",
              },
            ],
            details: {
              current: { l1_size_gib: 12 },
            },
          },
        }),
        false,
      ),
    ).toEqual({ kind: "ready", l1CapacityGiB: 12 });
  });

  it("distinguishes a reconciling manager from a failed one", () => {
    expect(
      readEndpointCacheManagerStatus(
        cluster({
          cache: {
            phase: "Reconciling",
            details: { current: { l1_size_gib: 8 } },
          },
        }),
        false,
      ),
    ).toMatchObject({
      kind: "pending",
      phase: "Reconciling",
      l1CapacityGiB: 8,
    });

    expect(
      readEndpointCacheManagerStatus(
        cluster({
          cache: {
            phase: "Failed",
            error_message: "cache control plane rejected the configuration",
          },
        }),
        false,
      ),
    ).toMatchObject({
      kind: "unavailable",
      phase: "Failed",
      errorMessage: "cache control plane rejected the configuration",
    });

    expect(
      readEndpointCacheManagerStatus(
        cluster({
          cache: {
            phase: "Ready",
            error_message: "runtime health check failed",
          },
        }),
        false,
      ),
    ).toMatchObject({
      kind: "unavailable",
      errorMessage: "runtime health check failed",
    });

    expect(
      readEndpointCacheManagerStatus(
        cluster({
          cache: {
            phase: "Ready",
            conditions: [
              {
                type: "Degraded",
                status: "False",
                reason: "RuntimeUnhealthy",
              },
            ],
          },
        }),
        false,
      ),
    ).toMatchObject({
      kind: "unavailable",
      errorMessage: "RuntimeUnhealthy",
    });
  });

  it("does not treat loading as a cache failure", () => {
    expect(readEndpointCacheManagerStatus(undefined, true)).toEqual({
      kind: "loading",
    });
    expect(readEndpointCacheManagerStatus(undefined, false)).toEqual({
      kind: "not-configured",
    });
  });
});
