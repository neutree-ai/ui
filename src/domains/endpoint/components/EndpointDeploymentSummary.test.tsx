import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Endpoint } from "@/domains/endpoint/types";
import { EndpointDeploymentSummary } from "./EndpointDeploymentSummary";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
  }),
}));

vi.mock("./KVCacheEstimate", () => ({
  KVCacheEstimate: ({
    read,
    onStateChange,
  }: {
    read: { state: string };
    onStateChange?: (state: unknown) => void;
  }) => {
    useEffect(() => {
      onStateChange?.(
        read.state === "ready"
          ? {
              kind: "ready",
              totalGb: 16.1,
              tokensPerSequence: 262_144,
              sequences: 256,
              precision: "bf16",
              family: "qwen_linear_full_hybrid",
            }
          : {
              kind: "unavailable",
              reason: read.state,
            },
      );
    }, [onStateChange, read]);
    return <div data-testid="kv-details">KV details</div>;
  },
}));

const values = {
  id: 0,
  api_version: "v1",
  kind: "Endpoint",
  metadata: { name: "qwen", workspace: "default" },
  spec: {
    cluster: "docker-t4",
    model: {
      registry: "huggingface",
      name: "Qwen3.6-27B-FP8",
      version: "main",
      file: "",
      task: "text-generation",
    },
    replicas: { num: 1 },
    resources: { cpu: 4, memory: 8, gpu: 1 },
    engine: { engine: "vllm", version: "0.8.5" },
    variables: { engine_args: {} },
    env: {},
    kv_cache: null,
    deployment_options: null,
    config: null,
    image_registry: "",
  },
  status: null,
} as unknown as Endpoint;

const kvCache = {
  read: { state: "ready" as const, info: {} },
  engineArgs: { maxModelLen: 262_144, maxNumSeqs: 1 },
  controls: { context: null, concurrency: null },
  modelKey: "hf:qwen:main",
};

describe("EndpointDeploymentSummary", () => {
  it("shows the combined per-replica total when weights and KV are known", async () => {
    render(
      <EndpointDeploymentSummary
        values={values}
        declared={{
          perReplicaGb: 27,
          source: "catalog",
          replicas: 1,
          accelerator: { product: "T4", perGpuGb: 16, gpuCount: 1 },
        }}
        kvCache={kvCache}
      />,
    );

    await waitFor(() => screen.getByText("43.1 GB"));
    screen.getByTestId("deployment-capacity-bar");
    screen.getByText("endpoints.weights.declared 27 GB");
    expect(screen.queryByText("qwen3-6-27b")).toBeNull();
    screen.getByTestId("vram-check-badge");

    fireEvent.click(
      screen.getByRole("button", {
        name: "endpoints.wizard.summary.showEstimateDetails",
      }),
    );
    expect(
      screen
        .getByTestId("kv-details")
        .closest("[aria-hidden]")
        ?.getAttribute("aria-hidden"),
    ).toBe("false");
  });

  it("does not invent a total when the available facts are insufficient", () => {
    render(
      <EndpointDeploymentSummary
        values={values}
        declared={null}
        kvCache={{
          ...kvCache,
          read: { state: "unreported" },
        }}
      />,
    );

    screen.getByText("endpoints.wizard.summary.estimateUnavailable");
    expect(screen.queryByTestId("deployment-capacity-bar")).toBeNull();
  });

  it("does not infer weights when the catalog does not declare them", async () => {
    render(
      <EndpointDeploymentSummary
        values={values}
        declared={null}
        kvCache={kvCache}
      />,
    );

    await waitFor(() => screen.getByText("16.1 GB"));
    screen.getByText("endpoints.wizard.summary.partialPerReplica");
    expect(screen.queryByText(/Weights 0 GB/)).toBeNull();
  });

  it("distinguishes checkpoint-estimated weights from catalog declarations", () => {
    render(
      <EndpointDeploymentSummary
        values={values}
        declared={{
          perReplicaGb: 16,
          source: "checkpoint",
          replicas: 1,
          accelerator: { product: "T4", perGpuGb: 16, gpuCount: 1 },
        }}
        kvCache={null}
      />,
    );

    screen.getByText("endpoints.weights.estimated 16 GB");
  });

  it("keeps the same ready KV estimate when the estimate refreshes", async () => {
    const view = render(
      <EndpointDeploymentSummary
        values={values}
        declared={{
          perReplicaGb: 27,
          source: "catalog",
          replicas: 1,
          accelerator: { product: "T4", perGpuGb: 16, gpuCount: 1 },
        }}
        kvCache={kvCache}
      />,
    );
    await waitFor(() => screen.getByText("43.1 GB"));

    view.rerender(
      <EndpointDeploymentSummary
        values={values}
        declared={{
          perReplicaGb: 27,
          source: "catalog",
          replicas: 1,
          accelerator: { product: "T4", perGpuGb: 16, gpuCount: 1 },
        }}
        kvCache={{ ...kvCache, read: { ...kvCache.read } }}
      />,
    );

    await waitFor(() => screen.getByText("43.1 GB"));
  });
});
