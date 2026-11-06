import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  makeEndpoint,
  makeReviewContext,
} from "@/domains/endpoint/testing/builders";
import { EndpointConfigurationSummary } from "./EndpointConfigurationSummary";

const values = makeEndpoint({
  spec: {
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
});

const reviewContext = makeReviewContext({
  catalogOrigin: {
    catalog: "qwen-catalog",
    variant: "fp8",
    features: [
      { name: "context_window", value: "32768" },
      { name: "tool_choice" },
    ],
    featuresUnreadable: false,
  },
  nodeCount: 2,
  clusterCapacity: [
    { key: "cpu", requested: 16, available: 248, total: 384 },
    { key: "memory", requested: 64, available: 980.5, total: 1536 },
    { key: "core", requested: 100, available: 500, total: 800 },
  ],
});

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
      "cluster-a",
      "· endpoints.fields.nodeCount 2",
      "models.scheduler.consistentHashing",
      "hf",
      "qwen",
      "text-generation",
      "endpoints.wizard.summary.versionResolvedAtDeployment",
      "endpoints.wizard.summary.fileDefaultEntryPoint",
      "vllm 0.31.0",
      "endpoints.wizard.summary.cacheConfiguration:zcache,5",
      "NVIDIA H100",
      "endpoints.wizard.summary.resourcePerReplicaValue:8,32,1",
      "endpoints.wizard.summary.gibValue:16",
      "endpoints.wizard.summary.percentValue:50",
      "248 endpoints.wizard.summary.available / 384 pages.vramCalculator.metrics.cores",
      "980.5 endpoints.wizard.summary.available / 1536 endpoints.options.gib",
      "500 endpoints.wizard.summary.available / 800",
    ]) {
      screen.getByText(text);
    }
    for (const [key, value] of [
      ["max_model_len", "8192"],
      ["TOKEN", "secret"],
    ]) {
      expect(screen.getByText(key).parentElement?.textContent).toBe(
        `${key}: ${value}`,
      );
    }
  });

  it("shows an unrecognised scheduler type as is", () => {
    render(
      <EndpointConfigurationSummary
        values={makeEndpoint({
          spec: { deployment_options: { scheduler: { type: "custom" } } },
        })}
        reviewContext={reviewContext}
      />,
    );

    screen.getByText("custom");
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
    screen.getByText("vllm 0.31.0");
  });

  it("shows compose and capacity failures without a catalog", () => {
    render(
      <EndpointConfigurationSummary
        values={makeEndpoint()}
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

  it("explains unreadable catalog features even when known features remain", () => {
    render(
      <EndpointConfigurationSummary
        values={values}
        reviewContext={{
          ...reviewContext,
          catalogOrigin: {
            ...reviewContext.catalogOrigin!,
            featuresUnreadable: true,
          },
        }}
      />,
    );

    screen.getByText("context_window: 32768");
    screen.getByText("endpoints.origin.featuresUnreadable");
  });
});
