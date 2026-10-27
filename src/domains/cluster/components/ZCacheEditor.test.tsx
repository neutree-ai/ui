import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Cluster } from "../types";
import { ZCacheEditor } from "./ZCacheEditor";

const mocks = vi.hoisted(() => ({ update: vi.fn(), access: true }));
vi.mock("@refinedev/core", () => ({
  useList: () => ({ data: { data: [] }, isLoading: false }),
  useCan: () => ({ data: { can: mocks.access } }),
  useUpdate: () => ({ mutateAsync: mocks.update, isLoading: false }),
  useInvalidate: () => vi.fn().mockResolvedValue(undefined),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
const cluster = {
  metadata: { name: "test", workspace: "default" },
  spec: {
    type: "kubernetes",
    config: { kubernetes_config: { kubeconfig: "", router: { replicas: 1 } } },
    version: "cluster-v1",
    cache: {
      provider: "zcache",
      options: {
        enabled: true,
        l1_size_gib: 2,
        target_nodes: ["a"],
      },
    },
  },
  status: {
    cache: {
      provider: "zcache",
      phase: "Ready",
      conditions: [],
      details: { candidates: [{ name: "a", selectable: true }] },
    },
  },
} as unknown as Cluster;
beforeEach(() => {
  mocks.update.mockReset().mockResolvedValue({});
  mocks.access = true;
});
describe("cache editing", () => {
  it("preserves the draft during polling and the latest unrelated settings when saving", async () => {
    const close = vi.fn();
    const { rerender } = render(
      <ZCacheEditor cluster={cluster} onClose={close} />,
    );
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "5" },
    });
    const refreshed = structuredClone(cluster);
    refreshed.spec.config.kubernetes_config!.router!.replicas = 3;
    rerender(<ZCacheEditor cluster={refreshed} onClose={close} />);
    expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe(
      "5",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "clusters.zcache.save" }),
    );
    await screen.findByText("clusters.zcache.capacityChangeDescription");
    expect(mocks.update).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "clusters.zcache.confirmSave" }),
    );
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    const { values } = mocks.update.mock.calls[0][0];
    expect(values.spec.cache?.options).toMatchObject({
      l1_size_gib: 5,
    });
    expect(values.spec.config.kubernetes_config).toEqual({
      router: { replicas: 3 },
    });
    expect(values).not.toHaveProperty("status");
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
  });
  it("requires confirmation to disable and can cancel without writing", async () => {
    render(<ZCacheEditor cluster={cluster} onClose={vi.fn()} />);
    fireEvent.click(
      screen.getByRole("checkbox", { name: "clusters.zcache.enable" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "clusters.zcache.save" }),
    );
    await screen.findByText("clusters.zcache.disableDescription");
    expect(mocks.update).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "clusters.zcache.disableTitle" }),
    );
    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    expect(
      mocks.update.mock.calls[0][0].values.spec.cache?.options.enabled,
    ).toBe(false);
  });
  it("does not submit an invalid capacity or a read-only user's edit", async () => {
    mocks.access = false;
    render(<ZCacheEditor cluster={cluster} onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "0" },
    });
    expect(
      (
        screen.getByRole("button", {
          name: "clusters.zcache.save",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("keeps a failed write open with the user's draft", async () => {
    mocks.update.mockRejectedValue(new Error("network unavailable"));
    const close = vi.fn();
    render(<ZCacheEditor cluster={cluster} onClose={close} />);
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "5" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "clusters.zcache.save" }),
    );
    await screen.findByText("clusters.zcache.capacityChangeDescription");
    fireEvent.click(
      screen.getByRole("button", { name: "clusters.zcache.confirmSave" }),
    );
    await screen.findByRole("alert");
    expect(close).not.toHaveBeenCalled();
    expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe(
      "5",
    );
  });
});

it.each([undefined, { provider: "zcache", options: { enabled: false } }])(
  "retries a failed service with incomplete disabled config %j",
  async (cache) => {
    const c = structuredClone(cluster);
    c.spec.cache = cache as Cluster["spec"]["cache"];
    c.status!.cache!.phase = "Failed";
    render(<ZCacheEditor cluster={c} onClose={vi.fn()} />);
    fireEvent.click(
      screen.getByRole("button", { name: "clusters.zcache.retry" }),
    );
    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    expect(mocks.update.mock.calls[0][0].values.spec.cache.options).toEqual({
      enabled: false,
      l1_size_gib: 1,
      target_nodes: [],
    });
  },
);
