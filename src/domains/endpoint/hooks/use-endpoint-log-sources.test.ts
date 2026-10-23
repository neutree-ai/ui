import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Endpoint } from "@/domains/endpoint/types";
import {
  getBackendReplicas,
  useEndpointLogSources,
} from "./use-endpoint-log-sources";

const mocks = vi.hoisted(() => ({ useCustom: vi.fn(), refetch: vi.fn() }));
vi.mock("@refinedev/core", () => ({ useCustom: mocks.useCustom }));

const endpoint = {
  metadata: { workspace: "default", name: "model" },
} as Endpoint;
const deployments = [
  {
    name: "Backend",
    replicas: [
      {
        replica_id: "pod",
        logs: [
          {
            type: "logs",
            url: "/logs/pod/logs",
            download_url: "/logs/pod/logs?download=true",
          },
        ],
        containers: [
          { name: "engine", type: "container" as const, restart_count: 1 },
        ],
      },
    ],
  },
];

beforeEach(() => {
  mocks.useCustom.mockReset().mockReturnValue({
    data: { data: { deployments } },
    isLoading: false,
    refetch: mocks.refetch,
  });
});
afterEach(cleanup);

describe("useEndpointLogSources", () => {
  it("preserves the additive container metadata and legacy logs unchanged", () => {
    const { result } = renderHook(() => useEndpointLogSources(endpoint));

    expect(result.current.deployments).toBe(deployments);
    expect(result.current.refetch).toBe(mocks.refetch);
    expect(mocks.useCustom).toHaveBeenCalledWith({
      url: "/endpoints/default/model/log-sources",
      method: "get",
      queryOptions: { enabled: true, staleTime: 30000 },
    });
  });

  it("does not expose cached sources after the endpoint is disabled", () => {
    const { result, rerender } = renderHook(
      ({ resource }: { resource: Endpoint | null }) =>
        useEndpointLogSources(resource),
      { initialProps: { resource: endpoint } as { resource: Endpoint | null } },
    );
    rerender({ resource: null });

    expect(result.current.deployments).toEqual([]);
    expect(mocks.useCustom).toHaveBeenLastCalledWith(
      expect.objectContaining({
        url: "",
        queryOptions: expect.objectContaining({ enabled: false }),
      }),
    );
  });

  it.each([{}, { workspace: "default" }, { name: "model" }])(
    "disables incomplete endpoint identities: %j",
    (metadata) => {
      const { result } = renderHook(() =>
        useEndpointLogSources({ metadata } as unknown as Endpoint),
      );

      expect(result.current.deployments).toEqual([]);
    },
  );

  it("supports initial loading without data", () => {
    mocks.useCustom.mockReturnValue({
      isLoading: true,
      refetch: mocks.refetch,
    });
    const { result } = renderHook(() => useEndpointLogSources(endpoint));

    expect(result.current.deployments).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });
});

describe("getBackendReplicas", () => {
  it("prefers Backend over other deployments", () => {
    expect(
      getBackendReplicas([{ name: "Router", replicas: [] }, ...deployments]),
    ).toBe(deployments[0].replicas);
  });

  it("keeps failed Ray Actor fallback and handles an empty list", () => {
    const replicas = [
      {
        replica_id: "failed-actor",
        logs: [
          {
            type: "stderr",
            url: "/stderr",
            download_url: "/stderr?download=true",
          },
        ],
      },
    ];
    expect(getBackendReplicas([{ name: "FailedActor", replicas }])).toBe(
      replicas,
    );
    expect(getBackendReplicas([])).toEqual([]);
  });
});
