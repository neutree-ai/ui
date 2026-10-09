import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Cluster } from "../types";
import { ZCacheControlPlane } from "./ZCacheControlPlane";

const update = vi.fn().mockResolvedValue({});
vi.mock("@refinedev/core", () => ({
  useCan: () => ({ data: { can: true } }),
  useUpdate: () => ({ mutateAsync: update, isLoading: false }),
  useInvalidate: () => vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock("@/foundation/components/ShowPage", () => ({
  ShowPage: {
    Row: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
}));
vi.mock("@/foundation/components/Timestamp", () => ({ default: () => null }));
const cluster = {
  metadata: { name: "test", workspace: "default" },
  spec: {
    type: "kubernetes",
    version: "cluster-v1",
    image_registry: "registry",
    config: {},
    zcache: { enabled: true, l1_size_gib: 8, target_nodes: ["node-a"] },
  },
  status: {
    zcache: {
      phase: "Applied",
      control_plane: {
        version: "cp-v1",
        target_version: "cp-v1",
        request_id: "old",
        phase: "Succeeded",
        ready: false,
        available_versions: [
          {
            version: "cp-v1",
            chart_version: "1.0.0",
            node_agent_version: "agent-v1",
            runtime_versions: ["runtime-v1"],
            upgrade_from: [],
          },
        ],
      },
    },
  },
} as unknown as Cluster;

describe("explicit control-plane actions", () => {
  it("keeps health separate from last action and submits only on confirmation", async () => {
    update.mockClear();
    render(<ZCacheControlPlane cluster={cluster} />);
    expect(
      screen.getByText("clusters.zcache.controlPlane.succeeded"),
    ).toBeTruthy();
    expect(screen.getByText("clusters.zcache.notReady")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: "clusters.zcache.controlPlane.manage",
      }),
    );
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", {
        name: "clusters.zcache.controlPlane.reapply",
      }),
    );
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    const values = update.mock.calls[0][0].values;
    expect(values).not.toHaveProperty("status");
    expect(values.spec.version).toBe("cluster-v1");
    expect(values.spec.zcache).toMatchObject({
      enabled: true,
      l1_size_gib: 8,
      target_nodes: ["node-a"],
      control_plane: { version: "cp-v1" },
    });
    expect(values.spec.zcache.control_plane.request_id).toMatch(
      /^[0-9a-f-]{36}$/,
    );
  });
  it("shows pending rather than the previous success after submission", () => {
    const pending = structuredClone(cluster);
    if (pending.spec.zcache)
      pending.spec.zcache.control_plane = {
        version: "cp-v1",
        request_id: "new",
      };
    render(<ZCacheControlPlane cluster={pending} />);
    expect(
      screen.getByText("clusters.zcache.controlPlane.pending"),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "clusters.zcache.controlPlane.manage" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });
});
