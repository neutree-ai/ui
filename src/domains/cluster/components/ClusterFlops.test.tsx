import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Cluster } from "../types";
import { ClusterFlops } from "./ClusterFlops";

const mocks = vi.hoisted(() => ({
  getOne: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@refinedev/core", () => ({
  useCustom: () => ({}),
  useDataProvider: () => () => ({ getOne: mocks.getOne }),
  useUpdate: () => ({ mutateAsync: mocks.update, isLoading: false }),
}));

const cluster = {
  id: 1,
  metadata: { name: "c", workspace: "default", annotations: { keep: "yes" } },
  spec: { type: "kubernetes" },
  status: {
    resource_info: {
      accelerator_metadata: {
        nvidia_gpu: { products: { "Tesla-T4": { peak_fp16_tflops: 65 } } },
      },
      node_resources: {
        n: { devices: [{ uuid: "g", product: "Tesla-T4", health: true }] },
      },
    },
  },
} as unknown as Cluster;

const calibrate = (value: string) => {
  render(<ClusterFlops cluster={cluster} samples={[]} />);
  fireEvent.click(
    screen.getByRole("button", { name: "observations.calibrate" }),
  );
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "buttons.save" }));
};

describe("ClusterFlops", () => {
  beforeEach(() => {
    mocks.getOne.mockReset().mockResolvedValue({ data: cluster });
    mocks.update.mockReset().mockResolvedValue({});
  });

  it("shows the estimated usage against the known capacity", () => {
    render(<ClusterFlops cluster={cluster} samples={[]} />);
    screen.getByText("— / 65.00 TFLOPS");
  });

  it("saves only metadata, merging the calibration into a fresh read", async () => {
    mocks.getOne.mockResolvedValue({
      data: {
        ...cluster,
        metadata: { ...cluster.metadata, annotations: { concurrent: "keep" } },
      },
    });

    calibrate("70");

    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    const values = mocks.update.mock.calls[0][0].values;
    expect(Object.keys(values)).toEqual(["metadata"]);
    expect(values.metadata.annotations).toEqual({
      concurrent: "keep",
      "neutree.ai/accelerator-tflops": '{"Tesla-T4":70}',
    });
  });

  it("rejects an invalid calibration without saving", async () => {
    calibrate("0");

    await screen.findByText("observations.invalidTflops");
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
