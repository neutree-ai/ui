import { describe, expect, it } from "vitest";
import type { Endpoint } from "@/domains/endpoint/types";
import { buildCatalogFromEndpoint } from "./save-as-catalog";

const endpoint = (spec: Partial<Endpoint["spec"]> = {}) =>
  ({
    metadata: {
      name: "qwen-chat",
      workspace: "team-a",
      labels: { "neutree.ai/last_replicas": "3" },
    },
    spec: {
      cluster: "prod",
      model: { registry: "hf", name: "Qwen/Qwen3-8B", version: "v2" },
      engine: { engine: "vllm", version: "0.24" },
      resources: { cpu: "4", memory: "16Gi", gpu: "1" },
      replicas: { num: 0 },
      deployment_options: { scheduler: { type: "consistent_hash" } },
      variables: { engine_args: { "max-model-len": 32768 } },
      env: { HF_TOKEN: "x" },
      ...spec,
    },
  }) as unknown as Endpoint;

describe("buildCatalogFromEndpoint", () => {
  it("carries the configuration over under the given name", () => {
    const catalog = buildCatalogFromEndpoint(endpoint(), "qwen-tuned");

    expect(catalog.metadata).toEqual({
      name: "qwen-tuned",
      workspace: "team-a",
      labels: {},
    });
    expect(catalog.spec).toEqual({
      model: { registry: "hf", name: "Qwen/Qwen3-8B", version: "v2" },
      engine: { engine: "vllm", version: "0.24" },
      resources: { cpu: "4", memory: "16Gi", gpu: "1" },
      deployment_options: { scheduler: { type: "consistent_hash" } },
      variables: { engine_args: { "max-model-len": 32768 } },
      env: { HF_TOKEN: "x" },
    });
  });

  // A catalog has no cluster, and a paused endpoint reports 0 replicas while
  // the real count waits in a label — saving either would be wrong.
  it("drops cluster and replicas", () => {
    const catalog = buildCatalogFromEndpoint(endpoint(), "qwen-tuned");

    expect(catalog.spec).not.toHaveProperty("cluster");
    expect(catalog.spec).not.toHaveProperty("replicas");
  });

  it("does not inherit the endpoint's labels", () => {
    const catalog = buildCatalogFromEndpoint(endpoint(), "qwen-tuned");

    expect((catalog.metadata as { labels: unknown }).labels).toEqual({});
  });

  // Recipe-deployed endpoints hold the composed engine args; the catalog states
  // that result and claims nothing about which layer produced it.
  it("writes the composed engine args flat, with no recipe structure", () => {
    const catalog = buildCatalogFromEndpoint(endpoint(), "qwen-tuned") as {
      spec: Record<string, unknown>;
    };

    expect(catalog.spec.variables).toEqual({
      engine_args: { "max-model-len": 32768 },
    });
    expect(catalog.spec).not.toHaveProperty("variants");
    expect(catalog.spec).not.toHaveProperty("features");
    expect(catalog.spec).not.toHaveProperty("base");
  });

  // Flex endpoints submit empty strings rather than omitting the model, and
  // that is carried over as-is: an absent model is refused by the catalog's
  // own spec check.
  it("carries an all-empty model through untouched", () => {
    const catalog = buildCatalogFromEndpoint(
      endpoint({
        model: { registry: "", name: "", file: "", version: "", task: "" },
      }),
      "flex-copy",
    ) as { spec: Record<string, unknown> };

    expect(catalog.spec.model).toEqual({
      registry: "",
      name: "",
      file: "",
      version: "",
      task: "",
    });
  });
});
