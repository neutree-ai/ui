import { fireEvent, render as renderUI, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Cluster } from "../types";
import { ClusterCacheSection } from "./ClusterCacheSection";

const render = (ui: ReactNode) => renderUI(ui, { wrapper: MemoryRouter });

vi.mock("@refinedev/core", () => ({ useCan: () => ({ data: { can: true } }) }));
vi.mock("./ZCacheEditor", () => ({ ZCacheEditor: () => null }));
vi.mock("./CacheRetry", () => ({
  CacheRetry: () => <button type="button">Retry service</button>,
}));
const capability = vi.hoisted(() => ({ value: true as boolean | undefined }));
vi.mock("@/foundation/hooks/use-system-api", () => ({
  useSystemApi: () => ({
    systemInfo: {
      capabilities: {
        cluster_cache_providers: capability.value ? ["zcache"] : [],
      },
    },
  }),
}));
beforeEach(() => {
  capability.value = true;
});
vi.mock("@/foundation/components/ShowPage", () => ({
  ShowPage: {
    Section: ({
      children,
      title,
      actions,
    }: {
      children: ReactNode;
      title: ReactNode;
      actions: ReactNode;
    }) => (
      <section>
        {title}
        {actions}
        {children}
      </section>
    ),
    Row: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  },
}));
vi.mock("@/foundation/components/Timestamp", () => ({
  default: ({ timestamp }: { timestamp: string }) => <span>{timestamp}</span>,
}));

type CacheOptions = {
  enabled: boolean;
  l1_size_gib: number;
  target_nodes: string[];
};

const makeCluster = (
  options: Partial<CacheOptions> | null,
  cache: Record<string, unknown>,
) =>
  ({
    spec: options
      ? {
          cache: {
            provider: "zcache",
            options: {
              enabled: true,
              l1_size_gib: 8,
              target_nodes: ["a"],
              ...options,
            },
          },
        }
      : {},
    status: { cache: { provider: "zcache", conditions: [], ...cache } },
  }) as unknown as Cluster;

const node = (name: string, gib: number) => ({
  name,
  runtime: "Ready",
  capacity_bytes: gib * 2 ** 30,
});

describe("ClusterCacheSection", () => {
  it.each([false, undefined])(
    "hides cache details without provider capability (%s)",
    (value) => {
      capability.value = value;
      const { container } = render(
        <ClusterCacheSection cluster={{ spec: {} } as Cluster} />,
      );
      expect(container.textContent).toBe("");
    },
  );

  it("does not label newly saved intent as applied using an old observation", () => {
    render(
      <ClusterCacheSection
        cluster={makeCluster(
          { l1_size_gib: 1 },
          {
            phase: "Ready",
            details: {
              observed_at: "now",
              current: { enabled: true, l1_size_gib: 8, target_nodes: ["a"] },
            },
          },
        )}
      />,
    );
    screen.getByText("clusters.zcache.reconciling");
  });

  it("shows pending enablement over an old Disabled observation", () => {
    render(
      <ClusterCacheSection
        cluster={makeCluster(
          { l1_size_gib: 1 },
          {
            phase: "Disabled",
            details: {
              current: { enabled: false, target_nodes: [] },
              nodes: [],
            },
          },
        )}
      />,
    );
    screen.getByText("clusters.zcache.reconciling");
    expect(screen.queryByText("clusters.zcache.disabled")).toBeNull();
  });

  it("shows rejected submission separately from current nodes and historical operations", () => {
    render(
      <ClusterCacheSection
        cluster={makeCluster(
          { l1_size_gib: 1 },
          {
            phase: "Failed",
            error_message: "API 422",
            details: {
              observed_at: "now",
              nodes: [node("a", 8)],
              change: { phase: "Rejected", message: "invalid capacity" },
              operations: [
                {
                  id: "old-operation",
                  phase: "Succeeded",
                  kind: "install",
                  nodes: [],
                },
              ],
            },
          },
        )}
      />,
    );
    screen.getByText("clusters.zcache.failed");
    screen.getByText("a");
    screen.getByText("8 GiB");
    expect(screen.queryByText("API 422")).toBeNull();
    expect(screen.queryByText(/old-operation/)).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "clusters.zcache.operations" }),
    );
    screen.getByText("API 422");
    screen.getByText(/clusters.zcache.notAccepted/);
    screen.getByText(/old-operation/);
  });

  it("renders heterogeneous node capacities instead of a uniform capacity summary", () => {
    render(
      <ClusterCacheSection
        cluster={makeCluster(
          { l1_size_gib: 10, target_nodes: ["a", "b"] },
          {
            phase: "Reconciling",
            details: {
              observed_at: "now",
              nodes: [node("a", 2), node("b", 8)],
              change: {
                phase: "Running",
                request: {
                  operation: { kind: "update_cache" },
                  lmcache: { l1SizeGb: 5, targetNodes: ["a", "b"] },
                },
              },
            },
          },
        )}
      />,
    );
    screen.getByText("2 GiB");
    screen.getByText("8 GiB");
    expect(screen.getByRole("status").textContent).toContain("5 GiB");
    expect(screen.getByRole("status").textContent).toContain(
      "clusters.zcache.latestTarget",
    );
  });

  it("does not label stale node observations ready", () => {
    render(
      <ClusterCacheSection
        cluster={makeCluster(
          { l1_size_gib: 2 },
          {
            phase: "Unavailable",
            conditions: [
              { type: "Ready", status: "Unknown", reason: "ObservationFailed" },
            ],
            details: {
              observed_at: "old",
              observation_error: "unreachable",
              nodes: [node("a", 2)],
            },
          },
        )}
      />,
    );
    expect(screen.queryByText("clusters.zcache.ready")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain(
      "clusters.zcache.stale",
    );
    screen.getByText("2 GiB");
  });

  it("shows failed configuration without hiding current availability", () => {
    render(
      <ClusterCacheSection
        cluster={makeCluster(
          {},
          {
            phase: "Failed",
            error_message: "capacity rejected",
            conditions: [
              {
                type: "ConfigurationApplied",
                status: "False",
                reason: "OperationFailed",
              },
              { type: "Ready", status: "True", reason: "RuntimeReady" },
            ],
            details: {
              observed_at: "now",
              current: { enabled: true, l1_size_gib: 2, target_nodes: ["a"] },
            },
          },
        )}
      />,
    );
    screen.getByText("clusters.zcache.failed");
    expect(screen.getByRole("alert").textContent).toContain(
      "clusters.zcache.stillAvailable",
    );
  });

  it.each([
    { status: "Unknown", label: "clusters.zcache.unknown" },
    { status: "False", label: "clusters.zcache.unavailable" },
  ])("shows Ready=$status as $label", ({ status, label }) => {
    render(
      <ClusterCacheSection
        cluster={makeCluster(
          {},
          {
            phase: "Unavailable",
            error_message: "query timed out",
            conditions: [
              { type: "Ready", status, reason: "ObservationFailed" },
            ],
            details: { observed_at: "earlier" },
          },
        )}
      />,
    );
    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  });

  it("exposes a retry for initial installation failure with no node inventory", () => {
    render(
      <ClusterCacheSection
        cluster={makeCluster(
          { enabled: false, l1_size_gib: 1, target_nodes: [] },
          {
            phase: "Failed",
            details: {
              control_plane: {
                phase: "Failed",
                ready: false,
                message: "install failed",
              },
            },
          },
        )}
      />,
    );
    screen.getByRole("button", { name: "Retry service" });
    expect(screen.queryByText("clusters.zcache.controlPlane.title")).toBeNull();
    expect(screen.queryByText("clusters.cache.providerLabel")).toBeNull();
  });

  it("omits node counts when disabled with no nodes", () => {
    render(
      <ClusterCacheSection
        cluster={makeCluster(null, {
          phase: "Disabled",
          details: { observed_at: "now", nodes: [] },
        })}
      />,
    );
    expect(screen.queryByText(/^clusters\.zcache\.readyCount/)).toBeNull();
  });
});
