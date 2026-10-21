import { afterEach, describe, it, expect, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { Cluster } from "../types";
import { ClusterFlops } from "./ClusterFlops";
const mocks = vi.hoisted(() => ({
  getOne: vi.fn(),
  update: vi.fn(),
  history: vi.fn(),
}));
vi.mock("@refinedev/core", () => ({
  useCustom: () => mocks.history(),
  useDataProvider: () => () => ({ getOne: mocks.getOne }),
  useUpdate: () => ({ mutateAsync: mocks.update, isLoading: false }),
}));
vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const cluster = {
  id: 1,
  metadata: { name: "c", workspace: "default", annotations: { keep: "yes" } },
  spec: { type: "kubernetes" },
  status: {
    resource_info: {
      node_resources: {
        n: { devices: [{ uuid: "g", product: "Tesla-T4", health: true }] },
      },
    },
  },
} as unknown as Cluster;
describe("compute calibration", () => {
  it("keeps historical known-card usage and zero points when other cards are unknown", () => {
    const sample = (time: number, uuid: string, product: string, value: number) => ({
      metric: "neutree_accelerator_utilization_ratio",
      labels: { node: "n", accelerator_uuid: uuid, product },
      observed_at: time, value,
    });
    mocks.history.mockReturnValue({ data: { data: {
      start: 1, end: 64801, samples: [
        sample(1, "unknown", "unknown", 0.8),
        sample(1, "g", "T4", 0.5),
        sample(21601, "g", "T4", 0),
        sample(21601, "unknown", "unknown", 0.8),
        sample(43201, "unknown", "unknown", 1),
        sample(64801, "g", "T4", 1.1),
      ],
    } } });
    const { container } = render(<ClusterFlops cluster={cluster} samples={[]} />);
    const titles = [...container.querySelectorAll("svg circle title")].map((e) => e.textContent);
    expect(titles).toHaveLength(2);
    expect(titles[0]).toContain("32.50 TFLOPS");
    expect(titles[1]).toContain("0.00 TFLOPS");
  });
  it("saves metadata only and merges annotations from a fresh read", async () => {
    mocks.history.mockReturnValue({});
    mocks.getOne.mockResolvedValue({
      data: {
        ...cluster,
        metadata: { ...cluster.metadata, annotations: { concurrent: "keep" } },
      },
    });
    mocks.update.mockResolvedValue({});
    render(<ClusterFlops cluster={cluster} samples={[]} />);
    fireEvent.click(
      screen.getByRole("button", { name: "observations.calibrate" }),
    );
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "70" },
    });
    fireEvent.click(screen.getByRole("button", { name: "buttons.save" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    const values = mocks.update.mock.calls[0][0].values;
    expect(Object.keys(values)).toEqual(["metadata"]);
    expect(values.metadata.annotations).toEqual({
      concurrent: "keep",
      "neutree.ai/accelerator-tflops": '{"Tesla-T4":70}',
    });
  });
  it("rejects nonpositive calibration and preserves unknown use", async () => {
    mocks.history.mockReturnValue({});
    render(<ClusterFlops cluster={cluster} samples={[]} />);
    expect(screen.getByText("— / 65.00 TFLOPS")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "observations.calibrate" }),
    );
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "buttons.save" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
