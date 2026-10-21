import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Cluster } from "../types";
import { ClusterCacheSection } from "./ClusterCacheSection";

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
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
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

describe("ClusterCacheSection", () => {
  it("does not label newly saved intent as applied using an old observation", () => {
    const cluster = {
      spec: {
        cache: {
          provider: "zcache",
          options: { enabled: true, l1_size_gib: 1, target_nodes: ["a"] },
        },
      },
      status: {
        cache: {
          provider: "zcache",
          phase: "Ready",
          conditions: [],
          details: {
            observed_at: "now",
            current: { enabled: true, l1_size_gib: 8, target_nodes: ["a"] },
          },
        },
      },
    } as unknown as Cluster;
    render(<ClusterCacheSection cluster={cluster} />);
    expect(screen.getByText("clusters.zcache.reconciling")).toBeTruthy();
  });

  it("shows rejected submission separately from current nodes and historical operations", () => {
    const cluster = {
      spec: {
        cache: {
          provider: "zcache",
          options: { enabled: true, l1_size_gib: 1, target_nodes: ["a"] },
        },
      },
      status: {
        cache: {
          provider: "zcache",
          phase: "Failed",
          error_message: "API 422",
          conditions: [],
          details: {
            observed_at: "now",
            nodes: [
              { name: "a", runtime: "Ready", capacity_bytes: 8 * 2 ** 30 },
            ],
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
      },
    } as unknown as Cluster;
    render(<ClusterCacheSection cluster={cluster} />);
    expect(screen.getByText("clusters.zcache.failed")).toBeTruthy();
    expect(screen.getByText("a")).toBeTruthy();
    expect(screen.getByText("8 GiB")).toBeTruthy();
    expect(screen.queryByText("API 422")).toBeNull();
    expect(screen.queryByText(/old-operation/)).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "clusters.zcache.operations" }),
    );
    expect(screen.getByText("API 422")).toBeTruthy();
    expect(screen.getByText(/clusters.zcache.notAccepted/)).toBeTruthy();
    expect(screen.getByText(/old-operation/)).toBeTruthy();
  });
});

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

it("renders heterogeneous node capacities instead of a uniform capacity summary", () => {
  const cluster = {
    spec: {
      cache: {
        provider: "zcache",
        options: { enabled: true, l1_size_gib: 10, target_nodes: ["a", "b"] },
      },
    },
    status: {
      cache: {
        provider: "zcache",
        phase: "Reconciling",
        conditions: [],
        details: {
          observed_at: "now",
          nodes: [
            { name: "a", runtime: "Ready", capacity_bytes: 2 * 2 ** 30 },
            { name: "b", runtime: "Ready", capacity_bytes: 8 * 2 ** 30 },
          ],
          change: {
            phase: "Running",
            request: {
              operation: { kind: "update_cache" },
              lmcache: { l1SizeGb: 5, targetNodes: ["a", "b"] },
            },
          },
        },
      },
    },
  } as unknown as Cluster;
  render(<ClusterCacheSection cluster={cluster} />);
  expect(screen.getByText("2 GiB")).toBeTruthy();
  expect(screen.getByText("8 GiB")).toBeTruthy();
  expect(screen.getByRole("status").textContent).toContain("5 GiB");
  expect(screen.getByRole("status").textContent).toContain(
    "clusters.zcache.latestTarget",
  );
});
it("does not label stale node observations ready", () => {
  const cluster = {
    spec: {
      cache: {
        provider: "zcache",
        options: { enabled: true, l1_size_gib: 2, target_nodes: ["a"] },
      },
    },
    status: {
      cache: {
        provider: "zcache",
        phase: "Unavailable",
        conditions: [
          { type: "Ready", status: "Unknown", reason: "ObservationFailed" },
        ],
        details: {
          observed_at: "old",
          observation_error: "unreachable",
          nodes: [{ name: "a", runtime: "Ready", capacity_bytes: 2 * 2 ** 30 }],
        },
      },
    },
  } as unknown as Cluster;
  render(<ClusterCacheSection cluster={cluster} />);
  expect(screen.queryByText("clusters.zcache.ready")).toBeNull();
  expect(screen.getByRole("alert").textContent).toContain(
    "clusters.zcache.stale",
  );
  expect(screen.getByText("2 GiB")).toBeTruthy();
});

it("shows failed configuration without hiding current availability", () => {
  const cluster = {
    spec: {
      cache: {
        provider: "zcache",
        options: { enabled: true, l1_size_gib: 8, target_nodes: ["a"] },
      },
    },
    status: {
      cache: {
        provider: "zcache",
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
    },
  } as unknown as Cluster;
  render(<ClusterCacheSection cluster={cluster} />);
  expect(screen.getByText("clusters.zcache.failed")).toBeTruthy();
  expect(screen.getByRole("alert").textContent).toContain(
    "clusters.zcache.stillAvailable",
  );
});

it("distinguishes unknown availability from confirmed unavailability", () => {
  const cluster = {
    spec: {
      cache: {
        provider: "zcache",
        options: { enabled: true, l1_size_gib: 8, target_nodes: ["a"] },
      },
    },
    status: {
      cache: {
        provider: "zcache",
        phase: "Unavailable",
        error_message: "query timed out",
        conditions: [
          { type: "Ready", status: "Unknown", reason: "ObservationFailed" },
        ],
        details: { observed_at: "earlier" },
      },
    },
  } as unknown as Cluster;
  const { rerender } = render(<ClusterCacheSection cluster={cluster} />);
  expect(screen.getAllByText("clusters.zcache.unknown").length).toBeGreaterThan(
    0,
  );
  cluster.status!.cache!.conditions[0].status = "False";
  rerender(<ClusterCacheSection cluster={cluster} />);
  expect(screen.getByText("clusters.zcache.unavailable")).toBeTruthy();
});

it("exposes a retry for initial installation failure with no node inventory", () => {
  const cluster = {
    spec: {
      cache: {
        provider: "zcache",
        options: { enabled: false, l1_size_gib: 1, target_nodes: [] },
      },
    },
    status: {
      cache: {
        provider: "zcache",
        phase: "Failed",
        conditions: [],
        details: {
          control_plane: {
            phase: "Failed",
            ready: false,
            message: "install failed",
          },
        },
      },
    },
  } as unknown as Cluster;
  render(<ClusterCacheSection cluster={cluster} />);
  expect(screen.getByRole("button", { name: "Retry service" })).toBeTruthy();
  expect(screen.queryByText("clusters.zcache.controlPlane.title")).toBeNull();
  expect(screen.queryByText("clusters.cache.providerLabel")).toBeNull();
});

it("shows pending enablement over an old Disabled observation", () => {
  const cluster = {
    spec: {
      cache: {
        provider: "zcache",
        options: { enabled: true, l1_size_gib: 1, target_nodes: ["a"] },
      },
    },
    status: {
      cache: {
        provider: "zcache",
        phase: "Disabled",
        conditions: [],
        details: { current: { enabled: false, target_nodes: [] }, nodes: [] },
      },
    },
  } as unknown as Cluster;
  render(<ClusterCacheSection cluster={cluster} />);
  expect(screen.getByText("clusters.zcache.reconciling")).toBeTruthy();
  expect(screen.queryByText("clusters.zcache.disabled")).toBeNull();
});
it("omits node counts when disabled with no nodes", () => {
  const cluster = {
    spec: {},
    status: {
      cache: {
        provider: "zcache",
        phase: "Disabled",
        conditions: [],
        details: { observed_at: "now", nodes: [] },
      },
    },
  } as unknown as Cluster;
  render(<ClusterCacheSection cluster={cluster} />);
  expect(screen.queryByText("clusters.zcache.readyCount")).toBeNull();
});
