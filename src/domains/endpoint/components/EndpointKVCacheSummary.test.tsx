import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { makeEndpoint } from "../testing/builders";
import type { EndpointClusterRef } from "../types";
import { EndpointKVCacheSummary } from "./EndpointKVCacheSummary";

const cluster = (enabled: boolean) =>
  ({
    metadata: { name: "gpu-cluster" },
    spec: { cache: { provider: "zcache", options: { enabled } } },
  }) as unknown as EndpointClusterRef;

const renderSummary = (kvCache: boolean, configured: boolean) =>
  render(
    <MemoryRouter>
      <EndpointKVCacheSummary
        endpoint={makeEndpoint({
          spec: {
            kv_cache: kvCache
              ? { provider: "zcache", options: { timeout_seconds: 2 } }
              : null,
          },
        })}
        cluster={cluster(configured)}
      />
    </MemoryRouter>,
  );

describe("EndpointKVCacheSummary", () => {
  it("shows the endpoint's timeout and links the cluster's cache", () => {
    renderSummary(true, true);

    screen.getByText("common.options.enabled");
    screen.getByText("endpoints.kvCacheSettings.timeoutValue:2");
    expect(screen.getByRole("link").getAttribute("href")).toBe(
      "/default/clusters/show/gpu-cluster?section=cache",
    );
  });

  it("says the endpoint opted out when the cluster offers the cache", () => {
    renderSummary(false, true);

    screen.getByText("common.options.disabled");
    screen.getByText("endpoints.kvCacheSettings.endpointDisabled");
  });

  it("renders nothing when the cluster has the cache off", () => {
    renderSummary(true, false);

    expect(screen.queryByText("endpoints.kvCacheSettings.enable")).toBeNull();
  });
});
