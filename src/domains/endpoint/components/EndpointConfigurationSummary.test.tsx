import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EndpointReviewContext } from "@/domains/endpoint/lib/review-context";
import type { Endpoint } from "@/domains/endpoint/types";
import { EndpointConfigurationSummary } from "./EndpointConfigurationSummary";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOptions?: unknown, options?: unknown) => {
      if (typeof fallbackOrOptions === "string") return fallbackOrOptions;
      const params = (fallbackOrOptions ?? options) as
        | Record<string, unknown>
        | undefined;
      if (key === "endpoints.wizard.summary.resourcePerReplicaValue") {
        return `${params?.cpu} CPU · ${params?.memory} GiB · ${params?.gpu} GPU`;
      }
      if (key === "endpoints.wizard.summary.cacheConfiguration") {
        return `${params?.provider} · ${params?.timeout}s timeout`;
      }
      if (key === "endpoints.wizard.summary.gibValue") {
        return `${params?.value} GiB`;
      }
      if (key === "endpoints.wizard.summary.percentValue") {
        return `${params?.value}%`;
      }
      if (key === "endpoints.wizard.summary.versionResolvedAtDeployment") {
        return "Resolved at deployment";
      }
      if (key === "endpoints.wizard.summary.fileDefaultEntryPoint") {
        return "Default entry point";
      }
      return key;
    },
  }),
}));

const values = {
  id: 1,
  api_version: "v1",
  kind: "Endpoint",
  metadata: { name: "summary", workspace: "default" },
  spec: {
    cluster: "gpu-k8s-west",
    model: {
      registry: "huggingface",
      name: "org/model",
      version: "",
      file: "",
      task: "text-generation",
    },
    engine: { engine: "vllm", version: "v0.32.0" },
    resources: {
      cpu: 8,
      memory: 32,
      gpu: 1,
      accelerator: {
        type: "nvidia_gpu",
        product: "NVIDIA H100",
        virtualization: { memory_mib: 16384, core_percent: 50 },
      },
    },
    replicas: { num: 2 },
    deployment_options: { scheduler: { type: "consistent_hash" } },
    kv_cache: { provider: "zcache", options: { timeout_seconds: 5 } },
    variables: { engine_args: { max_model_len: 8192 } },
    env: { TOKEN: "secret" },
  },
  status: null,
} as unknown as Endpoint;

const reviewContext: EndpointReviewContext = {
  catalogOrigin: {
    catalog: "qwen-catalog",
    variant: "fp8",
    features: [
      { name: "context_window", value: "32768" },
      { name: "tool_choice" },
    ],
    featuresUnreadable: false,
  },
  modelDelivery: "at-deploy-time",
  noVerifiedAccelerator: false,
  requiredVramGb: 32,
  nodeCount: 2,
  clusterCapacity: [
    { key: "cpu", requested: 16, available: 248, total: 384 },
    { key: "memory", requested: 64, available: 980, total: 1536 },
    { key: "cards", requested: 2, available: 5, total: 8 },
    { key: "vram", requested: 32, available: 302, total: 512 },
    { key: "core", requested: 100, available: 500, total: 800 },
  ],
  clusterCapacityUnavailable: false,
};

describe("EndpointConfigurationSummary", () => {
  it("shows every deployment-affecting endpoint field", () => {
    render(
      <EndpointConfigurationSummary
        values={values}
        reviewContext={reviewContext}
      />,
    );

    for (const text of [
      "qwen-catalog",
      "fp8",
      "context_window: 32768",
      "tool_choice",
      "gpu-k8s-west",
      "models.scheduler.consistentHashing",
      "huggingface",
      "org/model",
      "text-generation",
      "Resolved at deployment",
      "Default entry point",
      "vllm v0.32.0",
      "zcache · 5s timeout",
      "NVIDIA H100",
      "8 CPU · 32 GiB · 1 GPU",
      "16 GiB",
      "50%",
    ]) {
      screen.getByText(text);
    }
    expect(screen.getAllByText("2")).toHaveLength(2);
    for (const [key, values] of [
      ["cpu", ["248", "384"]],
      ["memory", ["980", "1536"]],
      ["cards", ["5", "8"]],
      ["vram", ["302", "512"]],
      ["core", ["500", "800"]],
    ] as const) {
      const row = screen.getByTestId(`configuration-capacity-${key}`);
      for (const value of values) expect(row.textContent).toContain(value);
    }
    expect(
      screen
        .getByTestId("endpoint-configuration-summary")
        .querySelector('[data-key-value-entry="max_model_len"]')?.textContent,
    ).toBe("max_model_len: 8192");
    expect(
      screen
        .getByTestId("endpoint-configuration-summary")
        .querySelector('[data-key-value-entry="TOKEN"]')?.textContent,
    ).toBe("TOKEN: secret");
  });

  it("omits the model section for an engine that brings its own workload", () => {
    render(
      <EndpointConfigurationSummary
        values={values}
        reviewContext={reviewContext}
        modelRequired={false}
      />,
    );

    expect(screen.queryByText("endpoints.fields.modelRegistry")).toBeNull();
    screen.getByText("vllm v0.32.0");
  });

  it("keeps unrecognized scheduler and capacity keys visible", () => {
    const unknownValues = structuredClone(values);
    unknownValues.spec.deployment_options = {
      scheduler: { type: "custom-scheduler" },
    };

    render(
      <EndpointConfigurationSummary
        values={unknownValues}
        reviewContext={{
          ...reviewContext,
          clusterCapacity: [
            { key: "disk" as never, requested: 1, available: 2, total: 3 },
            {
              key: "cpu",
              requested: 1.5,
              available: null,
              total: null,
            },
            {
              key: "memory",
              requested: 1.5,
              available: 2.5,
              total: 4,
            },
          ],
        }}
      />,
    );

    screen.getByText("custom-scheduler");
    screen.getByTestId("configuration-capacity-disk");
    expect(
      screen.getByTestId("configuration-capacity-memory").textContent,
    ).toContain("2.5");
  });

  it("renders empty and unavailable deployment details without a catalog", () => {
    render(
      <EndpointConfigurationSummary
        values={
          {
            metadata: { name: "empty", workspace: "default" },
            spec: {
              cluster: "",
              model: {
                registry: "",
                name: "",
                version: "",
                file: "",
                task: "",
              },
              engine: { engine: "", version: "" },
              resources: null,
              replicas: null,
              deployment_options: null,
              kv_cache: null,
              variables: null,
              env: null,
            },
          } as unknown as Endpoint
        }
        reviewContext={{
          ...reviewContext,
          catalogOrigin: null,
          nodeCount: null,
          clusterCapacity: null,
          clusterCapacityUnavailable: true,
        }}
        composeError="Compose failed"
      />,
    );

    screen.getByText("Compose failed");
    screen.getByText("endpoints.wizard.summary.cacheDisabled");
    screen.getByText("endpoints.messages.clusterResourcesUnavailable");
  });

  it("explains unreadable catalog features when no feature list is available", () => {
    render(
      <EndpointConfigurationSummary
        values={values}
        reviewContext={{
          ...reviewContext,
          catalogOrigin: {
            catalog: "qwen-catalog",
            variant: "fp8",
            features: [],
            featuresUnreadable: true,
          },
        }}
      />,
    );

    screen.getByText("endpoints.origin.featuresUnreadable");
  });
});
