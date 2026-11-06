import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Endpoint } from "@/domains/endpoint/types";
import { isHidden } from "@/foundation/testing/interactions";
import { EndpointDeploymentSummary } from "./EndpointDeploymentSummary";

vi.mock("./KVCacheEstimate", () => ({
  KVCacheEstimate: () => <div data-testid="kv-details">KV details</div>,
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

const catalogWeights = {
  perReplicaGb: 27,
  source: "catalog" as const,
  replicas: 1,
  accelerator: { product: "T4", perGpuGb: 16, gpuCount: 1 },
};

const renderSummary = (
  props: Partial<Parameters<typeof EndpointDeploymentSummary>[0]> = {},
) =>
  render(
    <EndpointDeploymentSummary
      values={values}
      declared={null}
      kvCache={kvCache}
      kvCacheGb={null}
      onKvCacheStateChange={vi.fn()}
      {...props}
    />,
  );

describe("EndpointDeploymentSummary", () => {
  it("shows the combined per-replica total when weights and KV are known", () => {
    renderSummary({ declared: catalogWeights, kvCacheGb: 16.1 });

    screen.getByText("43.1 GB");
    screen.getByText("endpoints.weights.declared 27 GB");
    screen.getByTestId("vram-check-badge");

    fireEvent.click(
      screen.getByRole("button", {
        name: "endpoints.wizard.summary.showEstimateDetails",
      }),
    );
    expect(isHidden(screen.getByTestId("kv-details"))).toBe(false);
  });

  it("does not invent a total when neither weights nor KV are known", () => {
    renderSummary();

    screen.getByText("endpoints.wizard.summary.estimateUnavailable");
    expect(screen.queryByTestId("deployment-capacity-bar")).toBeNull();
  });

  it("labels a KV-only total as partial rather than inferring weights", () => {
    renderSummary({ kvCacheGb: 16.1 });

    screen.getByText("16.1 GB");
    screen.getByText("endpoints.wizard.summary.partialPerReplica");
  });

  it("distinguishes checkpoint-estimated weights from catalog declarations", () => {
    renderSummary({
      declared: { ...catalogWeights, perReplicaGb: 16, source: "checkpoint" },
      kvCache: null,
    });

    screen.getByText("endpoints.weights.estimated 16 GB");
  });

  it("reports cache as enabled when the endpoint configures it", () => {
    renderSummary({
      values: {
        ...values,
        spec: {
          ...values.spec,
          kv_cache: { provider: "zcache", options: { timeout_seconds: 5 } },
        },
      },
      kvCache: null,
    });

    screen.getByText("endpoints.wizard.summary.cacheEnabled");
  });
});
